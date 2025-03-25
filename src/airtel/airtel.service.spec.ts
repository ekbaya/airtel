import { Test, TestingModule } from '@nestjs/testing';
import { AirtelService } from './airtel.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { of, throwError } from 'rxjs';

// Comprehensive mock to prevent any real API calls
const mockHttpService = {
  post: jest.fn((url: string) => {
    if (url.includes('token')) {
      return of({
        data: {
          access_token: 'mocked-access-token',
          expires_in: 3600,
        },
      });
    }
    return throwError(() => new Error('Unexpected API call'));
  }),
  get: jest.fn((url: string) => {
    if (url.includes('encryption-keys')) {
      return of({
        data: {
          status: { success: true },
          data: {
            key: 'mocked-rsa-key',
            valid_upto: new Date(Date.now() + 3600000).toISOString(),
          },
        },
      });
    }
    return throwError(() => new Error('Unexpected API call'));
  }),
  request: jest.fn(() =>
    of({
      data: { success: true },
    }),
  ),
};

const mockConfig: Record<string, string | boolean> = {
  AIRTEL_TOKEN_URL: 'https://mock-airtel.com/token',
  AIRTEL_CLIENT_ID: 'mock-client-id',
  AIRTEL_CLIENT_SECRET: 'mock-client-secret',
  AIRTEL_BASE_URL: 'https://mock-airtel.com',
  AIRTEL_ENCRYPTION_KEYS_URL: 'https://mock-airtel.com/encryption-keys',
  AIRTEL_SIGNATURE_ENABLED: true,
};

const mockConfigService = {
  get: jest.fn((key: string) => mockConfig[key]),
};

const mockCacheManager = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

describe('AirtelService', () => {
  let airtelService: AirtelService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AirtelService,
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
      ],
    }).compile();

    airtelService = module.get<AirtelService>(AirtelService);

    // Globally mock makeHTTPRequest to avoid real API calls
    jest
      .spyOn(airtelService, 'makeHTTPRequest')
      .mockImplementation(async (url) => {
        if (url.includes('token')) {
          return {
            access_token: 'mocked-access-token',
            expires_in: 3600,
          };
        }
        if (url.includes('encryption-keys')) {
          return {
            status: { success: true },
            data: {
              key: 'mocked-rsa-key',
              valid_upto: new Date(Date.now() + 3600000).toISOString(),
            },
          };
        }
        return Promise.reject(new Error('Unexpected API call'));
      });
  });

  it('should be defined', () => {
    expect(airtelService).toBeDefined();
  });

  describe('getAccessToken', () => {
    // it('should return cached token if available', async () => {
    //   // Mock cache to return a cached token
    //   mockCacheManager.get.mockResolvedValueOnce('cached-access-token');
    //   const token = await airtelService.getAccessToken();
    //   expect(token).toBe('cached-access-token');
    //   expect(mockCacheManager.get).toHaveBeenCalledWith('AIRTEL_ACCESS_TOKEN');
    // });
    // it('should fetch and cache a new token if not cached', async () => {
    //   // Mock cache to return null first
    //   mockCacheManager.get.mockResolvedValueOnce(null);
    //   const token = await airtelService.getAccessToken();
    //   expect(token).toBe('mocked-access-token');
    //   expect(mockCacheManager.set).toHaveBeenCalledWith(
    //     'AIRTEL_ACCESS_TOKEN',
    //     'mocked-access-token',
    //     3540, // expires_in - 60 seconds
    //   );
    // });
    // it('should throw UnauthorizedException if token fetch fails', async () => {
    //   // Mock cache to return null
    //   mockCacheManager.get.mockResolvedValueOnce(null);
    //   // Mock makeHTTPRequest to simulate a failed request
    //   jest
    //     .spyOn(airtelService, 'makeHTTPRequest')
    //     .mockRejectedValueOnce(new Error('Token fetch failed'));
    //   await expect(airtelService.getAccessToken()).rejects.toThrow(
    //     UnauthorizedException,
    //   );
    // });
  });

  describe('fetchRsaPublicKey', () => {
    // it('should return cached RSA key if available', async () => {
    //   // Mock cache to return a cached RSA key
    //   mockCacheManager.get.mockResolvedValueOnce('cached-rsa-key');
    //   const rsaKey = await airtelService['fetchRsaPublicKey']('UG', 'UGX');
    //   expect(rsaKey).toBe('cached-rsa-key');
    //   expect(mockCacheManager.get).toHaveBeenCalledWith(
    //     expect.stringContaining('RSA_PUBLIC_KEY_UG_UGX'),
    //   );
    // });
  });
});
