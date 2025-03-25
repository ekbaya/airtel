import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import * as crypto from 'crypto';

import {
  TokenRequestDto,
  TokenResponseDto,
  EncryptionKeysResponse,
} from './dto';

@Injectable()
export class AirtelService {
  private readonly logger = new Logger(AirtelService.name);
  private readonly CACHE_TOKEN_KEY = 'AIRTEL_ACCESS_TOKEN';
  private readonly CACHE_RSA_KEY = 'AIRTEL_RSA_KEY';
  private readonly LOCK_KEY = 'AIRTEL_TOKEN_REFRESH_LOCK';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * Retrieve an access token with distributed locking mechanism
   */
  async getAccessToken(): Promise<string> {
    // Check if a valid token exists in cache
    const cachedToken = await this.cacheManager.get<string>(
      this.CACHE_TOKEN_KEY,
    );
    if (cachedToken) {
      return cachedToken;
    }

    // Create a distributed lock
    const lockId = await this.acquireLock();

    try {
      // Double-check token in case another process already refreshed
      const doubleCheckToken = await this.cacheManager.get<string>(
        this.CACHE_TOKEN_KEY,
      );
      if (doubleCheckToken) {
        return doubleCheckToken;
      }

      // Fetch new token
      const newToken = await this.fetchNewToken();

      // Cache the token with an expiration slightly before its actual expiration
      await this.cacheManager.set(
        this.CACHE_TOKEN_KEY,
        newToken.access_token,
        newToken.expires_in - 60, // Cache for slightly less than full expiration
      );

      return newToken.access_token;
    } finally {
      // Always release the lock
      await this.releaseLock(lockId);
    }
  }

  /**
   * Fetch a new token from the Airtel authentication endpoint
   */
  private async fetchNewToken(): Promise<TokenResponseDto> {
    try {
      const tokenUrl = this.configService.get<string>('AIRTEL_TOKEN_URL');
      const clientId = this.configService.get<string>('AIRTEL_CLIENT_ID');
      const clientSecret = this.configService.get<string>(
        'AIRTEL_CLIENT_SECRET',
      );

      if (!clientId || !clientSecret || !tokenUrl) {
        throw new Error('Missing required Airtel configuration');
      }

      const tokenRequestDto: TokenRequestDto = {
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
      };

      const response = await lastValueFrom(
        this.httpService.post<TokenResponseDto>(tokenUrl, tokenRequestDto),
      );

      this.logger.log('Successfully fetched new Airtel access token');
      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch Airtel access token', error);
      throw new UnauthorizedException('Could not obtain Airtel access token');
    }
  }

  /**
   * Fetch RSA Public Key from Airtel Encryption Keys API
   */
  private async fetchRsaPublicKey(
    country: string,
    currency: string,
  ): Promise<string> {
    // Check if key is cached
    const cachedKey = await this.cacheManager.get<string>(this.CACHE_RSA_KEY);
    if (cachedKey) {
      return cachedKey;
    }

    try {
      // Get access token
      const accessToken = await this.getAccessToken();

      // Fetch encryption keys
      const encryptionKeysUrl = this.configService.get<string>(
        'AIRTEL_ENCRYPTION_KEYS_URL',
      );

      if (!encryptionKeysUrl) {
        throw new Error('Missing AIRTEL_ENCRYPTION_KEYS_URL configuration');
      }

      const response = await lastValueFrom(
        this.httpService.get<EncryptionKeysResponse>(encryptionKeysUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Country': country,
            'X-Currency': currency,
          },
        }),
      );

      // Validate response
      if (!response.data.status.success) {
        throw new Error(
          `Failed to fetch RSA key: ${response.data.status.message}`,
        );
      }

      const rsaPublicKey = response.data.data.key;

      // Cache the key with expiration
      const validUpto = new Date(response.data.data.valid_upto);
      const expirationTime = validUpto.getTime() - Date.now();

      await this.cacheManager.set(
        this.CACHE_RSA_KEY,
        rsaPublicKey,
        expirationTime > 0 ? expirationTime : 3600000, // 1 hour fallback
      );

      return rsaPublicKey;
    } catch (error) {
      this.logger.error('Failed to fetch RSA public key', error);
      throw new UnauthorizedException('Could not obtain RSA public key');
    }
  }

  /**
   * Generate message signature for Airtel API request
   */
  private async generateMessageSignature(
    payload: any,
    country: string,
    currency: string,
  ): Promise<{
    'x-signature': string;
    'x-key': string;
  }> {
    try {
      // Check if signature is enabled in configuration
      const isSignatureEnabled = this.configService.get<boolean>(
        'AIRTEL_SIGNATURE_ENABLED',
        false,
      );

      if (!isSignatureEnabled) {
        return { 'x-signature': '', 'x-key': '' };
      }

      // 1. Generate random AES key and IV
      const aesKey = crypto.randomBytes(32); // 256-bit key
      const iv = crypto.randomBytes(16); // 128-bit IV

      // 2. Base64 encode AES key and IV
      const base64Key = aesKey.toString('base64');
      const base64Iv = iv.toString('base64');

      // 3. Fetch RSA public key dynamically
      const rsaPublicKey = await this.fetchRsaPublicKey(country, currency);
      if (!rsaPublicKey) {
        throw new Error('Failed to retrieve RSA Public Key');
      }

      // 4. Encrypt payload using AES
      const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, iv);
      let encryptedPayload = cipher.update(
        JSON.stringify(payload),
        'utf8',
        'base64',
      );
      encryptedPayload += cipher.final('base64');

      // 5. Concatenate base64 encoded key and IV
      const keyIvConcatenated = `${base64Key}:${base64Iv}`;

      // 6. Encrypt key:iv using RSA public key
      const rsaPublicKeyBuffer = Buffer.from(rsaPublicKey, 'base64');
      const encryptedKeyIv = crypto
        .publicEncrypt(
          {
            key: rsaPublicKeyBuffer,
            padding: crypto.constants.RSA_PKCS1_PADDING,
          },
          Buffer.from(keyIvConcatenated),
        )
        .toString('base64');

      return {
        'x-signature': encryptedPayload,
        'x-key': encryptedKeyIv,
      };
    } catch (error) {
      this.logger.error('Failed to generate message signature', error);
      return { 'x-signature': '', 'x-key': '' };
    }
  }

  /**
   * Make an authenticated Airtel API request with optional message signing
   */
  async makeApiRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    data?: any,
    additionalHeaders: Record<string, string> = {},
    options: {
      signatureRequired?: boolean;
    } = { signatureRequired: false },
  ): Promise<T> {
    const baseUrl = this.configService.get<string>('AIRTEL_BASE_URL');
    const accessToken = await this.getAccessToken();

    // Extract country and currency from additional headers
    const country =
      additionalHeaders['X-Country'] || additionalHeaders['x-country'] || 'UG';
    const currency =
      additionalHeaders['X-Currency'] ||
      additionalHeaders['x-currency'] ||
      'UGX';

    // Prepare headers
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: '*/*',
      ...additionalHeaders,
    };

    // Apply message signing if required
    if (options.signatureRequired && data) {
      try {
        const { 'x-signature': xSignature, 'x-key': xKey } =
          await this.generateMessageSignature(data, country, currency);

        // Add signature headers
        headers['x-signature'] = xSignature;
        headers['x-key'] = xKey;
      } catch (error) {
        this.logger.error('Failed to generate message signature', error);
        throw new Error('Signature generation failed');
      }
    }

    try {
      const response = await lastValueFrom(
        this.httpService.request<T>({
          method,
          url: `${baseUrl}/${endpoint}`,
          headers,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: data || {},
        }),
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Airtel API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  /**
   * Validate incoming request signature (for reference)
   * This method would be used on the server-side to verify the signature
   */
  public validateSignature(
    payload: any,
    xSignature: string,
    xKey: string,
  ): boolean {
    try {
      // Decrypt the x-key using private RSA key
      const rsaPrivateKey = this.configService.get<string>(
        'AIRTEL_RSA_PRIVATE_KEY',
      );
      if (!rsaPrivateKey) {
        this.logger.warn('RSA Private Key not configured');
        return false;
      }

      // Decrypt the key:iv pair
      const decryptedKeyIv = crypto
        .privateDecrypt(
          {
            key: rsaPrivateKey,
            padding: crypto.constants.RSA_PKCS1_PADDING,
          },
          Buffer.from(xKey, 'base64'),
        )
        .toString('utf8');

      // Split decrypted key:iv
      const [base64Key, base64Iv] = decryptedKeyIv.split(':');

      // Convert back to buffers
      const aesKey = Buffer.from(base64Key, 'base64');
      const iv = Buffer.from(base64Iv, 'base64');

      // Decrypt the payload
      const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);
      let decryptedPayload = decipher.update(xSignature, 'base64', 'utf8');
      decryptedPayload += decipher.final('utf8');

      // Compare decrypted payload with original
      return JSON.stringify(payload) === decryptedPayload;
    } catch (error) {
      this.logger.error('Signature validation failed', error);
      return false;
    }
  }

  /**
   * Acquire a distributed lock to prevent simultaneous token refreshes
   */
  private async acquireLock(): Promise<string> {
    const lockId = crypto.randomBytes(16).toString('hex');
    const lockAcquired = await this.cacheManager.set(
      this.LOCK_KEY,
      lockId,
      30, // 30-second lock timeout
    );

    if (!lockAcquired) {
      // Wait and retry
      await new Promise((resolve) => setTimeout(resolve, 100));
      return this.acquireLock();
    }

    return lockId;
  }

  /**
   * Release the distributed lock
   */
  private async releaseLock(lockId: string): Promise<void> {
    const currentLock = await this.cacheManager.get<string>(this.LOCK_KEY);
    if (currentLock === lockId) {
      await this.cacheManager.del(this.LOCK_KEY);
    }
  }
}
