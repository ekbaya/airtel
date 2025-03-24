import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AirtelService } from '../airtel/airtel.service';
import { UssdPaymentRequestDto, UssdPaymentResponseDto } from './dto';
import * as crypto from 'crypto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
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

      // Optional: Implement message signing if required
      const { signature, key } = this.generateMessageSignature(paymentRequest);

      if (signature && key) {
        additionalHeaders['x-signature'] = signature;
        additionalHeaders['x-key'] = key;
      }

      // Make the API request
      const response =
        await this.airtelService.makeApiRequest<UssdPaymentResponseDto>(
          'merchant/v2/payments/',
          'POST',
          paymentRequest,
          additionalHeaders,
        );

      this.logger.log('USSD Payment initiated successfully');
      return response;
    } catch (error) {
      this.logger.error('USSD Payment initiation failed', error);
      throw error;
    }
  }

  /**
   * Generate message signature (if required by API)
   * Note: Implement actual encryption logic based on Airtel's specific requirements
   */
  private generateMessageSignature(payload: UssdPaymentRequestDto): {
    signature?: string;
    key?: string;
  } {
    try {
      // Check if signature is enabled in configuration
      const isSignatureEnabled = this.configService.get<boolean>(
        'AIRTEL_SIGNATURE_ENABLED',
        false,
      );

      if (!isSignatureEnabled) {
        return {};
      }

      // Placeholder for actual signature generation
      // You'll need to replace this with Airtel's specific encryption method
      const secretKey = this.configService.get<string>(
        'AIRTEL_SIGNATURE_SECRET',
      );

      if (!secretKey) {
        this.logger.warn('Signature secret not configured');
        return {};
      }

      // Example placeholder - replace with actual implementation
      const signature = crypto
        .createHmac('sha256', secretKey)
        .update(JSON.stringify(payload))
        .digest('base64');

      // Placeholder for key generation
      const key = 'PLACEHOLDER_ENCRYPTED_KEY';

      return { signature, key };
    } catch (error) {
      this.logger.error('Failed to generate message signature', error);
      return {};
    }
  }
}
