import { IsString, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SubscriberDto } from './subscriber.dto';
import { TransactionDto } from './transaction.dto';

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
