/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import * as crypto from 'crypto';

import { TokenRequestDto, TokenResponseDto } from './dto';

@Injectable()
export class AirtelService {
  private readonly logger = new Logger(AirtelService.name);
  private readonly CACHE_TOKEN_KEY = 'AIRTEL_ACCESS_TOKEN';
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
   * Make an authenticated Airtel API request
   */
  async makeApiRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    data?: any,
    additionalHeaders: Record<string, string> = {},
  ): Promise<T> {
    const baseUrl = this.configService.get<string>('AIRTEL_BASE_URL');
    const accessToken = await this.getAccessToken();

    try {
      const response = await lastValueFrom(
        this.httpService.request<T>({
          method,
          url: `${baseUrl}/${endpoint}`,
          headers: {
            // Default headers
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: '*/*',

            // Merge with additional headers (allowing override of default headers)
            ...additionalHeaders,
          },
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
