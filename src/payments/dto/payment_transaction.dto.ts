import { IsString } from 'class-validator';

export class PaymentTransactionDto {
  @IsString()
  id: string;

  @IsString()
  status: string;
}
