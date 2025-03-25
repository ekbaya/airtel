import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { PaymentResultController } from './payment-result.controller';
import { RabbitMqconfigModule } from 'src/rabbit-mqconfig/rabbit-mqconfig.module';
import { RabbitMQConfigService } from 'src/rabbit-mqconfig/rabbit-mqconfig.service';
import { PaymentQueues, PaymentServices } from 'src/domain/constants/payment';

@Module({
  imports: [
    RabbitMqconfigModule,
    ClientsModule.registerAsync([
      {
        name: PaymentServices.PaymentResultService,
        imports: [RabbitMqconfigModule],
        useFactory: (configService: RabbitMQConfigService) =>
          configService.createRmqOptions(PaymentQueues.PaymentQueue),
        inject: [RabbitMQConfigService],
      },
    ]),
  ],
  controllers: [PaymentResultController],
  exports: [ClientsModule],
})
export class PaymentResultModule {}
