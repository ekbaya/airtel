import {
  Injectable,
  Logger,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import * as crypto from 'crypto';

import {
  TokenRequestDto,
  TokenResponseDto,
  EncryptionKeysResponse,
} from './dto';

enum HTTPMethod {
  POST = 'POST',
  GET = 'GET',
}

@Injectable()
export class AirtelService {
  private readonly logger = new Logger(AirtelService.name);
  private readonly CACHE_TOKEN_KEY = 'AIRTEL_ACCESS_TOKEN';
  private readonly CACHE_RSA_KEY = 'AIRTEL_RSA_KEY';
  private readonly LOCK_KEY = 'AIRTEL_TOKEN_REFRESH_LOCK';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /**
   * Retrieve an access token with a distributed locking mechanism
   */
  getAccessToken = async (): Promise<string> => {
    const cachedToken = await this.cacheManager.get<string>(
      this.CACHE_TOKEN_KEY,
    );
    if (cachedToken) return cachedToken;

    const lockId = await this.acquireLock();

    try {
      const doubleCheckToken = await this.cacheManager.get<string>(
        this.CACHE_TOKEN_KEY,
      );
      if (doubleCheckToken) return doubleCheckToken;

      const { access_token, expires_in } = await this.fetchNewToken();

      await this.cacheManager.set(
        this.CACHE_TOKEN_KEY,
        access_token,
        expires_in - 60,
      );
      return access_token;
    } finally {
      await this.releaseLock(lockId);
    }
  };

  /**
   * Fetch a new token from the Airtel authentication endpoint
   */
  private fetchNewToken = async (): Promise<TokenResponseDto> => {
    try {
      const tokenUrl = this.configService.get<string>('AIRTEL_TOKEN_URL');
      const clientId = this.configService.get<string>('AIRTEL_CLIENT_ID');
      const clientSecret = this.configService.get<string>(
        'AIRTEL_CLIENT_SECRET',
      );

      if (!tokenUrl || !clientId || !clientSecret)
        throw new Error('Missing required Airtel configuration');

      const tokenRequestDto: TokenRequestDto = {
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
      };

      const response = (await this.makeHTTPRequest(
        tokenUrl,
        HTTPMethod.POST,
        tokenRequestDto,
      )) as TokenResponseDto;

      this.logger.log('Successfully fetched new Airtel access token');
      return response;
    } catch (error) {
      this.logger.error('Failed to fetch Airtel access token', error);
      throw new UnauthorizedException('Could not obtain Airtel access token');
    }
  };

  /**
   * Fetch RSA Public Key from Airtel Encryption Keys API
   */
  private fetchRsaPublicKey = async (
    country: string,
    currency: string,
  ): Promise<string> => {
    const cachedKey = await this.cacheManager.get<string>(this.CACHE_RSA_KEY);
    if (cachedKey) return cachedKey;

    try {
      const accessToken = await this.getAccessToken();
      const encryptionKeysUrl = this.configService.get<string>(
        'AIRTEL_ENCRYPTION_KEYS_URL',
      );

      if (!encryptionKeysUrl)
        throw new Error('Missing AIRTEL_ENCRYPTION_KEYS_URL configuration');

      const response: EncryptionKeysResponse = (await this.makeHTTPRequest(
        encryptionKeysUrl,
        HTTPMethod.GET,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Country': country,
            'X-Currency': currency,
          },
        },
      )) as EncryptionKeysResponse;

      if (!response.status.success)
        throw new Error(`Failed to fetch RSA key: ${response.status.message}`);

      const rsaPublicKey = response.data.key;
      const expirationTime =
        new Date(response.data.valid_upto).getTime() - Date.now();

      await this.cacheManager.set(
        this.CACHE_RSA_KEY,
        rsaPublicKey,
        expirationTime > 0 ? expirationTime : 3600000,
      );
      return rsaPublicKey;
    } catch (error) {
      this.logger.error('Failed to fetch RSA public key', error);
      throw new UnauthorizedException('Could not obtain RSA public key');
    }
  };

  /**
   * Generate message signature for Airtel API request
   */
  private generateMessageSignature = async (
    payload: any,
    country: string,
    currency: string,
  ) => {
    try {
      if (!this.configService.get<boolean>('AIRTEL_SIGNATURE_ENABLED', false)) {
        return { 'x-signature': '', 'x-key': '' };
      }

      const aesKey = crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);
      const rsaPublicKey = await this.fetchRsaPublicKey(country, currency);
      if (!rsaPublicKey) throw new Error('Failed to retrieve RSA Public Key');

      const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, iv);
      const encryptedPayload =
        cipher.update(JSON.stringify(payload), 'utf8', 'base64') +
        cipher.final('base64');

      const keyIvConcatenated = `${aesKey.toString('base64')}:${iv.toString('base64')}`;
      const encryptedKeyIv = crypto
        .publicEncrypt(
          {
            key: Buffer.from(rsaPublicKey, 'base64'),
            padding: crypto.constants.RSA_PKCS1_PADDING,
          },
          Buffer.from(keyIvConcatenated),
        )
        .toString('base64');

      return { 'x-signature': encryptedPayload, 'x-key': encryptedKeyIv };
    } catch (error) {
      this.logger.error('Failed to generate message signature', error);
      return { 'x-signature': '', 'x-key': '' };
    }
  };

  makeHTTPRequest = async (
    url: string,
    method: HTTPMethod,
    headers?: any,
    payload?: any,
  ): Promise<any> => {
    const response = await lastValueFrom(
      method === HTTPMethod.POST
        ? this.httpService.post<any>(url, payload)
        : this.httpService.get<any>(url, headers),
    );

    if (response.data) {
      return response.data;
    }
    return response;
  };

  /**
   * Make an authenticated Airtel API request with optional message signing
   */
  makeApiRequest = async (
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    data?: Record<string, any>,
    additionalHeaders: Record<string, string> = {},
    options = { signatureRequired: false },
  ): Promise<any> => {
    const baseUrl = this.configService.get<string>('AIRTEL_BASE_URL');
    const accessToken = await this.getAccessToken();
    const { 'X-Country': country = 'UG', 'X-Currency': currency = 'UGX' } =
      additionalHeaders;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: '*/*',
      ...additionalHeaders,
    };

    if (options.signatureRequired && data) {
      const { 'x-signature': xSignature, 'x-key': xKey } =
        await this.generateMessageSignature(data, country, currency);
      headers['x-signature'] = xSignature;
      headers['x-key'] = xKey;
    }

    try {
      const response = await lastValueFrom(
        this.httpService.request({
          method,
          url: `${baseUrl}/${endpoint}`,
          headers,
          data,
        }),
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Airtel API request failed: ${endpoint}`, error);
      throw error;
    }
  };

  /**
   * Acquire a distributed lock to prevent simultaneous token refreshes
   */
  private acquireLock = async (): Promise<string> => {
    const lockId = crypto.randomBytes(16).toString('hex');
    if (!(await this.cacheManager.set(this.LOCK_KEY, lockId, 30))) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return this.acquireLock();
    }
    return lockId;
  };

  /**
   * Release the distributed lock
   */
  private releaseLock = async (lockId: string): Promise<void> => {
    if ((await this.cacheManager.get<string>(this.LOCK_KEY)) === lockId) {
      await this.cacheManager.del(this.LOCK_KEY);
    }
  };
}
