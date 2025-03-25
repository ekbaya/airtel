import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AirtelService } from '../airtel/airtel.service';

import * as crypto from 'crypto';
import {
  TransactionStatusResponseDto,
  UssdPaymentRequestDto,
  UssdPaymentResponseDto,
  CallbackRequestDto,
  CallbackTransactionData,
} from './dto';
import { RabbitMQService } from '../rabbit-mq/rabbit-mq.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly rabbitMQService: RabbitMQService,
    private readonly airtelService: AirtelService,
    private readonly configService: ConfigService,
  ) {}

  async initiateUssdPayment(
    paymentRequest: UssdPaymentRequestDto,
    country: string,
    currency: string,
  ): Promise<UssdPaymentResponseDto> {
    try {
      const additionalHeaders = {
        'X-Country': country,
        'X-Currency': currency,
        Accept: 'application/json',
      };

      const response = (await this.airtelService.makeApiRequest(
        'merchant/v2/payments/',
        'POST',
        paymentRequest,
        additionalHeaders,
        { signatureRequired: true },
      )) as UssdPaymentResponseDto;

      this.logger.log('USSD Payment initiated successfully');
      return response;
    } catch (error) {
      this.logger.error('USSD Payment initiation failed', error);
      throw error;
    }
  }

  async getTransactionStatus(
    transactionId: string,
    country: string,
    currency: string,
  ): Promise<TransactionStatusResponseDto> {
    try {
      const additionalHeaders = {
        Accept: 'application/json',
        'X-Country': country,
        'X-Currency': currency,
      };

      const response = (await this.airtelService.makeApiRequest(
        `standard/v1/payments/${transactionId}`,
        'GET',
        additionalHeaders,
      )) as TransactionStatusResponseDto;

      this.logger.log(`Transaction status retrieved for ID: ${transactionId}`);
      return response;
    } catch (error) {
      this.logger.error(
        `Failed to retrieve transaction status for ID: ${transactionId}`,
        error,
      );
      throw error;
    }
  }

  async processPaymentCallback(
    callbackRequest: CallbackRequestDto,
    contentType: string,
  ): Promise<{ status: string }> {
    this.validateContentType(contentType);

    this.authenticateCallback(callbackRequest);

    return this.handleTransactionCallback(callbackRequest);
  }

  private validateContentType(contentType: string): void {
    if (contentType !== 'application/json') {
      throw new UnauthorizedException('Invalid Content-Type');
    }
  }

  private authenticateCallback(callbackRequest: CallbackRequestDto): void {
    const privateKey = this.configService.get<string>('AIRTEL_PRIVATE_KEY');
    const enableCallbackAuth = this.configService.get<boolean>(
      'ENABLE_CALLBACK_AUTH',
      false,
    );

    if (!enableCallbackAuth || !privateKey) {
      return;
    }

    if (!callbackRequest.hash) {
      throw new UnauthorizedException('Callback hash is missing');
    }

    const payload = JSON.stringify(callbackRequest.transaction);

    const generatedHash = crypto
      .createHmac('sha256', privateKey)
      .update(payload)
      .digest('base64');

    if (generatedHash !== callbackRequest.hash) {
      throw new UnauthorizedException('Invalid callback authentication');
    }
  }

  handleTransactionCallback = async (
    callbackRequest: CallbackRequestDto,
  ): Promise<{ status: string }> => {
    try {
      const { transaction } = callbackRequest;

      this.logger.log(`Received callback for transaction: ${transaction.id}`);

      if (transaction.status_code === 'TS') {
        await this.handleSuccessfulTransaction(transaction);
      } else if (transaction.status_code === 'TF') {
        await this.handleFailedTransaction(transaction);
      } else {
        this.logger.warn(`Unknown status code: ${transaction.status_code}`);
        return { status: 'Bad Request' };
      }

      return { status: 'OK' };
    } catch (error) {
      this.logger.error('Error processing payment callback', error);
      throw error;
    }
  };

  handleSuccessfulTransaction = async (
    transaction: CallbackTransactionData,
  ) => {
    try {
      this.logger.log(`Publishing successful transaction: ${transaction.id}`);

      await this.rabbitMQService.publishPaymentResult(
        'payment.success',
        transaction,
      );
    } catch (error) {
      this.logger.error('Failed to publish successful transaction', error);
      throw error;
    }
  };

  handleFailedTransaction = async (transaction: CallbackTransactionData) => {
    try {
      this.logger.log(`Publishing failed transaction: ${transaction.id}`);

      await this.rabbitMQService.publishPaymentResult(
        'payment.failure',
        transaction,
      );
    } catch (error) {
      this.logger.error('Failed to publish failed transaction', error);
      throw error;
    }
  };
}
