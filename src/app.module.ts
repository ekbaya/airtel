import { Module } from '@nestjs/common';
import { AirtelModule } from './airtel/airtel.module';
import { PaymentsModule } from './payments/payments.module';
import { PaymentResultModule } from './payment-result/payment-result.module';
import { RabbitMQConfigService } from './rabbit-mqconfig/rabbit-mqconfig.service';
import { ConfigModule } from '@nestjs/config';
import { RabbitMqconfigModule } from './rabbit-mqconfig/rabbit-mqconfig.module';

@Module({
  imports: [
    AirtelModule,
    PaymentsModule,
    PaymentResultModule,
    ConfigModule.forRoot(),
    RabbitMqconfigModule,
  ],
  providers: [RabbitMQConfigService],
})
export class AppModule {}
