import {
  Controller,
  Post,
  Body,
  Headers,
  UseInterceptors,
  ClassSerializerInterceptor,
  Get,
  Param,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import {
  TransactionStatusResponseDto,
  UssdPaymentRequestDto,
  UssdPaymentResponseDto,
  CallbackRequestDto,
} from './dto';

@Controller('payments')
@UseInterceptors(ClassSerializerInterceptor)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('ussd')
  async initiateUssdPayment(
    @Body() paymentRequest: UssdPaymentRequestDto,
    @Headers('X-Country') country: string,
    @Headers('X-Currency') currency: string,
  ): Promise<UssdPaymentResponseDto> {
    return this.paymentsService.initiateUssdPayment(
      paymentRequest,
      country,
      currency,
    );
  }

  @Get('status/:transactionId')
  async getTransactionStatus(
    @Param('transactionId') transactionId: string,
    @Headers('X-Country') country: string,
    @Headers('X-Currency') currency: string,
  ): Promise<TransactionStatusResponseDto> {
    return this.paymentsService.getTransactionStatus(
      transactionId,
      country,
      currency,
    );
  }

  @Post('callback')
  async handlePaymentCallback(
    @Body() callbackRequest: CallbackRequestDto,
    @Headers('Content-Type') contentType: string,
  ): Promise<{ status: string }> {
    return this.paymentsService.processPaymentCallback(
      callbackRequest,
      contentType,
    );
  }
}
