import {
  IsString,
  IsObject,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TransactionStatusEnquiryRequestDto {
  @IsString()
  @IsOptional()
  reference?: string;
}

export class TransactionStatusResponseDto {
  @IsObject()
  @ValidateNested()
  @Type(() => TransactionDataDto)
  data: TransactionDataDto;
}

export class TransactionDataDto {
  @IsObject()
  @ValidateNested()
  @Type(() => TransactionDetailsDto)
  transaction: TransactionDetailsDto;

  @IsObject()
  @ValidateNested()
  @Type(() => TransactionStatusDto)
  status: TransactionStatusDto;
}

export class TransactionDetailsDto {
  @IsString()
  @IsOptional()
  airtel_money_id?: string;

  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  @IsOptional()
  message?: string;

  @IsString()
  @IsOptional()
  status?: 'TF' | 'TS' | 'TA' | 'TIP' | 'TE';
}

export class TransactionStatusDto {
  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  message?: string;

  @IsString()
  @IsOptional()
  result_code?: string;

  @IsString()
  @IsOptional()
  response_code?: string;

  @IsOptional()
  success: boolean = false;
}
