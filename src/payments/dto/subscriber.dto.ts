import { IsString, IsOptional } from 'class-validator';

export class SubscriberDto {
  @IsString()
  country: string;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  msisdn: string;
}
