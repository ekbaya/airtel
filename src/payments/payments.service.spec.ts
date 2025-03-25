import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { RabbitMQService } from '../rabbit-mq/rabbit-mq.service';
import { AirtelService } from '../airtel/airtel.service';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';

import {
  TransactionStatusResponseDto,
  UssdPaymentRequestDto,
  UssdPaymentResponseDto,
  CallbackRequestDto,
  CallbackTransactionData,
} from './dto';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let rabbitMQService: RabbitMQService;
  let airtelService: AirtelService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: RabbitMQService,
          useValue: {
            publishPaymentResult: jest.fn(),
          },
        },
        {
          provide: AirtelService,
          useValue: {
            makeApiRequest: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    rabbitMQService = module.get<RabbitMQService>(RabbitMQService);
    airtelService = module.get<AirtelService>(AirtelService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('initiateUssdPayment', () => {
    it('should initiate USSD payment and return response', async () => {
      const mockRequest: UssdPaymentRequestDto = {
        reference: 'Testing transaction',
        subscriber: {
          country: 'UG',
          currency: 'UGX',
          msisdn: '123456789',
        },
        transaction: {
          amount: 1000,
          country: 'UG',
          currency: 'UGX',
          id: 'random-unique-id',
        },
      };
      const mockResponse: UssdPaymentResponseDto = {
        data: {
          transaction: {
            id: false,
            status: 'SUCCESS',
          },
        },
        status: {
          code: '200',
          message: 'SUCCESS',
          result_code: 'ESB000010',
          response_code: 'DP00800001006',
          success: true,
        },
      };

      (airtelService.makeApiRequest as jest.Mock).mockResolvedValue(
        mockResponse,
      );

      const result = await service.initiateUssdPayment(
        mockRequest,
        'KE',
        'KES',
      );
      expect(result).toEqual(mockResponse);
      expect(airtelService.makeApiRequest).toHaveBeenCalledWith(
        'merchant/v2/payments/',
        'POST',
        mockRequest,
        { 'X-Country': 'KE', 'X-Currency': 'KES', Accept: 'application/json' },
        { signatureRequired: true },
      );
    });

    it('should throw an error if USSD payment fails', async () => {
      (airtelService.makeApiRequest as jest.Mock).mockRejectedValue(
        new Error('API failure'),
      );

      await expect(
        service.initiateUssdPayment({} as UssdPaymentRequestDto, 'KE', 'KES'),
      ).rejects.toThrow('API failure');
    });
  });

  describe('getTransactionStatus', () => {
    it('should return transaction status', async () => {
      const mockResponse: TransactionStatusResponseDto = {
        data: {
          transaction: {
            airtel_money_id: 'C36*******67',
            id: '83****88',
            message: 'success',
            status: 'TS',
          },
        },
        status: {
          code: '200',
          message: 'SUCCESS',
          result_code: 'ESB000010',
          response_code: 'DP00800001006',
          success: false,
        },
      };

      (airtelService.makeApiRequest as jest.Mock).mockResolvedValue(
        mockResponse,
      );

      const result = await service.getTransactionStatus('12345', 'KE', 'KES');
      expect(result).toEqual(mockResponse);
      expect(airtelService.makeApiRequest).toHaveBeenCalledWith(
        'standard/v1/payments/12345',
        'GET',
        { Accept: 'application/json', 'X-Country': 'KE', 'X-Currency': 'KES' },
      );
    });

    it('should throw an error if transaction status retrieval fails', async () => {
      (airtelService.makeApiRequest as jest.Mock).mockRejectedValue(
        new Error('API failure'),
      );

      await expect(
        service.getTransactionStatus('12345', 'KE', 'KES'),
      ).rejects.toThrow('API failure');
    });
  });

  describe('processPaymentCallback', () => {
    const callbackRequest: CallbackRequestDto = {
      transaction: {
        id: 'txn123',
        status_code: 'TS',
      } as CallbackTransactionData,
      hash: 'valid_hash',
    };

    const invalidCallbackRequest: CallbackRequestDto = {
      transaction: {
        id: 'txn123',
        status_code: 'TS',
      } as CallbackTransactionData,
      hash: '1',
    };

    const missingHashCallbackRequest: CallbackRequestDto = {
      transaction: {
        id: 'txn123',
        status_code: 'TS',
      } as CallbackTransactionData,
      hash: '',
    };

    it('should throw an error for invalid Content-Type', async () => {
      await expect(
        service.processPaymentCallback(callbackRequest, 'text/plain'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should process successful transaction', async () => {
      jest
        .spyOn(service, 'handleTransactionCallback')
        .mockResolvedValue({ status: 'OK' });

      const result = await service.processPaymentCallback(
        callbackRequest,
        'application/json',
      );
      expect(result).toEqual({ status: 'OK' });
      expect(service.handleTransactionCallback).toHaveBeenCalledWith(
        callbackRequest,
      );
    });

    it('should throw an error for missing hash', async () => {
      configService.get = jest.fn().mockImplementation((key) => {
        if (key === 'AIRTEL_PRIVATE_KEY') return 'test_secret';
        if (key === 'ENABLE_CALLBACK_AUTH') return true;
        return undefined;
      });

      await expect(
        service.processPaymentCallback(
          missingHashCallbackRequest,
          'application/json',
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw an error for invalid callback authentication', async () => {
      configService.get = jest.fn().mockImplementation((key) => {
        if (key === 'AIRTEL_PRIVATE_KEY') return 'test_secret';
        if (key === 'ENABLE_CALLBACK_AUTH') return true;
        return undefined;
      });

      await expect(
        service.processPaymentCallback(
          invalidCallbackRequest,
          'application/json',
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('handleTransactionCallback', () => {
    it('should handle a successful transaction', async () => {
      const transaction: CallbackTransactionData = {
        id: 'BBZMiscxy',
        message:
          'Paid UGX 5,000 to TECHNOLOGIES LIMITED Charge UGX 140, Trans ID MP210603.1234.L06941.',
        status_code: 'TS',
        airtel_money_id: 'MP210603.1234.L06941',
      };

      jest
        .spyOn(service, 'handleSuccessfulTransaction')
        .mockResolvedValue(undefined);
      await service.handleTransactionCallback({ transaction });

      expect(service.handleSuccessfulTransaction).toHaveBeenCalledWith(
        transaction,
      );
    });

    it('should handle a failed transaction', async () => {
      const transaction: CallbackTransactionData = {
        id: 'BBZMiscxy',
        message:
          'Paid UGX 5,000 to TECHNOLOGIES LIMITED Charge UGX 140, Trans ID MP210603.1234.L06941.',
        status_code: 'TF',
        airtel_money_id: 'MP210603.1234.L06941',
      };

      jest
        .spyOn(service, 'handleFailedTransaction')
        .mockResolvedValue(undefined);
      await service.handleTransactionCallback({ transaction });

      expect(service.handleFailedTransaction).toHaveBeenCalledWith(transaction);
    });

    it('should log a warning for unknown status codes', async () => {
      const result = await service.handleTransactionCallback({
        transaction: {
          id: 'BBZMiscxy',
          message:
            'Paid UGX 5,000 to TECHNOLOGIES LIMITED Charge UGX 140, Trans ID MP210603.1234.L06941.',
          status_code: 'UNKNOWN',
          airtel_money_id: 'MP210603.1234.L06941',
        },
      });

      expect(result).toEqual({ status: 'Bad Request' });
    });
  });

  describe('handleSuccessfulTransaction', () => {
    it('should publish a successful transaction', async () => {
      const transaction: CallbackTransactionData = {
        id: 'BBZMiscxy',
        message:
          'Paid UGX 5,000 to TECHNOLOGIES LIMITED Charge UGX 140, Trans ID MP210603.1234.L06941.',
        status_code: 'TS',
        airtel_money_id: 'MP210603.1234.L06941',
      };

      await service.handleSuccessfulTransaction(transaction);
      expect(rabbitMQService.publishPaymentResult).toHaveBeenCalledWith(
        'payment.success',
        transaction,
      );
    });
  });

  describe('handleFailedTransaction', () => {
    it('should publish a failed transaction', async () => {
      const transaction: CallbackTransactionData = {
        id: 'BBZMiscxy',
        message:
          'Paid UGX 5,000 to TECHNOLOGIES LIMITED Charge UGX 140, Trans ID MP210603.1234.L06941.',
        status_code: 'TF',
        airtel_money_id: 'MP210603.1234.L06941',
      };

      await service.handleFailedTransaction(transaction);
      expect(rabbitMQService.publishPaymentResult).toHaveBeenCalledWith(
        'payment.failure',
        transaction,
      );
    });
  });
});
