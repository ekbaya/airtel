import {
  IsString,
  IsNumber,
  IsObject,
  ValidateNested,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SubscriberDto {
  @IsString()
  country: string;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  msisdn: string;
}

export class TransactionDto {
  @IsNumber()
  amount: number;

  @IsString()
  id: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  currency?: string;
}

export class UssdPaymentRequestDto {
  @IsString()
  reference: string;

  @IsObject()
  @ValidateNested()
  @Type(() => SubscriberDto)
  subscriber: SubscriberDto;

  @IsObject()
  @ValidateNested()
  @Type(() => TransactionDto)
  transaction: TransactionDto;
}

export class PaymentStatusDto {
  @IsString()
  code: string;

  @IsString()
  message: string;

  @IsString()
  response_code: string;

  @IsString()
  result_code: string;

  @IsString()
  success: boolean;
}

export class PaymentTransactionDto {
  @IsBoolean()
  id: boolean;

  @IsString()
  status: string;
}

class TransactionDataDto {
  @IsObject()
  transaction: PaymentTransactionDto;
}

export class UssdPaymentResponseDto {
  @IsObject()
  @ValidateNested()
  @Type(() => TransactionDataDto)
  data: TransactionDataDto;

  @IsObject()
  @ValidateNested()
  @Type(() => PaymentStatusDto)
  status: PaymentStatusDto;
}
