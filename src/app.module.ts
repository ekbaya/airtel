import { Module } from '@nestjs/common';
import { AirtelModule } from './airtel/airtel.module';
import { PaymentsModule } from './payments/payments.module';
import { ConfigModule } from '@nestjs/config';
import { RabbitMQService } from './rabbit-mq/rabbit-mq.service';
import { RabbitMqModule } from './rabbit-mq/rabbit-mq.module';

@Module({
  imports: [
    AirtelModule,
    PaymentsModule,
    ConfigModule.forRoot(),
    RabbitMqModule,
  ],
  providers: [RabbitMQService],
})
export class AppModule {}
