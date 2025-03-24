import { Module } from '@nestjs/common';
import { AirtelModule } from './airtel/airtel.module';
import { PaymentsModule } from './payments/payments.module';

@Module({
  imports: [AirtelModule, PaymentsModule],
})
export class AppModule {}
