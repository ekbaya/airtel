import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { AirtelModule } from 'src/airtel/airtel.module';
import { ConfigModule } from '@nestjs/config';
import { RabbitMqconfigModule } from 'src/rabbit-mqconfig/rabbit-mqconfig.module';
import { PaymentResultModule } from 'src/payment-result/payment-result.module';

@Module({
  imports: [
    RabbitMqconfigModule,
    AirtelModule,
    ConfigModule,
    PaymentResultModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
