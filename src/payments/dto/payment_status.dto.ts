import { IsString } from 'class-validator';

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
