import {
  Controller,
  Post,
  Body,
  Headers,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { UssdPaymentRequestDto, UssdPaymentResponseDto } from './dto';

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
}
