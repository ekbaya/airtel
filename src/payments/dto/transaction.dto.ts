import { IsString, IsNumber, IsOptional } from 'class-validator';

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
