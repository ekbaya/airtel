import { IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentTransactionDto } from './payment_transaction.dto';
import { PaymentStatusDto } from './payment_status.dto';

export class UssdPaymentResponseDto {
  @IsObject()
  @ValidateNested()
  @Type(() => PaymentTransactionDto)
  transaction: PaymentTransactionDto;

  @IsObject()
  @ValidateNested()
  @Type(() => PaymentStatusDto)
  status: PaymentStatusDto;
}
