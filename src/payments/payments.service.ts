import {
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
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
import { ClientProxy, RmqRecordBuilder } from '@nestjs/microservices';
import { PaymentServices } from 'src/domain/constants/payment';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(PaymentServices.PaymentResultService)
    private readonly paymentResultClient: ClientProxy,
    private readonly airtelService: AirtelService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Initiate USSD Payment
   */
  async initiateUssdPayment(
    paymentRequest: UssdPaymentRequestDto,
    country: string,
    currency: string,
  ): Promise<UssdPaymentResponseDto> {
    try {
      // Prepare additional headers
      const additionalHeaders = {
        'X-Country': country,
        'X-Currency': currency,
        Accept: 'application/json',
      };

      // Make the API request (signature is required)
      const response =
        await this.airtelService.makeApiRequest<UssdPaymentResponseDto>(
          'merchant/v2/payments/',
          'POST',
          paymentRequest,
          additionalHeaders,
          { signatureRequired: true },
        );

      this.logger.log('USSD Payment initiated successfully');
      return response;
    } catch (error) {
      this.logger.error('USSD Payment initiation failed', error);
      throw error;
    }
  }

  /**
   * Enquire about transaction status
   * @param transactionId Transaction ID to check status
   * @param country Transaction Country
   * @param currency Transaction Currency
   * @returns Transaction status details
   */
  async getTransactionStatus(
    transactionId: string,
    country: string,
    currency: string,
  ): Promise<TransactionStatusResponseDto> {
    try {
      // Prepare headers as per API specification
      const additionalHeaders = {
        Accept: 'application/json',
        'X-Country': country,
        'X-Currency': currency,
      };

      // Make the API request to check transaction status
      const response =
        await this.airtelService.makeApiRequest<TransactionStatusResponseDto>(
          `standard/v1/payments/${transactionId}`,
          'GET',
          additionalHeaders,
        );

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
    // Validate Content-Type
    this.validateContentType(contentType);

    // Authenticate callback if hash is provided
    this.authenticateCallback(callbackRequest);

    // Process the transaction based on its status
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

    // Skip authentication if not enabled
    if (!enableCallbackAuth || !privateKey) {
      return;
    }

    // If authentication is enabled, hash must be present
    if (!callbackRequest.hash) {
      throw new UnauthorizedException('Callback hash is missing');
    }

    // Prepare the payload for hashing (exclude the hash itself)
    const payload = JSON.stringify(callbackRequest.transaction);

    // Generate HMAC SHA256 hash in Base64
    const generatedHash = crypto
      .createHmac('sha256', privateKey)
      .update(payload)
      .digest('base64');

    // Compare the generated hash with the received hash
    if (generatedHash !== callbackRequest.hash) {
      throw new UnauthorizedException('Invalid callback authentication');
    }
  }

  private async handleTransactionCallback(
    callbackRequest: CallbackRequestDto,
  ): Promise<{ status: string }> {
    try {
      const { transaction } = callbackRequest;

      // Log the callback for audit purposes
      this.logger.log(`Received callback for transaction: ${transaction.id}`);

      // Process based on transaction status
      switch (transaction.status_code) {
        case 'TS': // Transaction Success
          await this.handleSuccessfulTransaction(transaction);
          break;
        case 'TF': // Transaction Failed
          await this.handleFailedTransaction(transaction);
          break;
        default:
          this.logger.warn(`Unknown status code: ${transaction.status_code}`);
      }

      return { status: 'OK' };
    } catch (error) {
      this.logger.error('Error processing payment callback', error);
      throw error;
    }
  }

  async handleSuccessfulTransaction(transaction: CallbackTransactionData) {
    try {
      // Create a record with additional options if needed
      const record = new RmqRecordBuilder({
        ...transaction,
        status: 'SUCCESS',
        timestamp: new Date().toISOString(),
      })
        .setOptions({
          headers: {
            'x-transaction-type': 'payment-success',
          },
          priority: 1, // Optional priority
        })
        .build();

      // Emit the event to RabbitMQ
      await this.paymentResultClient
        .emit('payment.success', record)
        .toPromise();
    } catch (error) {
      // Log or handle error
      console.error('Failed to publish payment success', error);
    }
  }

  async handleFailedTransaction(transaction: CallbackTransactionData) {
    try {
      const record = new RmqRecordBuilder({
        ...transaction,
        status: 'FAILED',
        timestamp: new Date().toISOString(),
      })
        .setOptions({
          headers: {
            'x-transaction-type': 'payment-failure',
          },
          priority: 2, // Potentially higher priority for failures
        })
        .build();

      await this.paymentResultClient
        .emit('payment.failure', record)
        .toPromise();
    } catch (error) {
      console.error('Failed to publish payment failure', error);
    }
  }
}
