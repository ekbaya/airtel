import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { PaymentResultController } from './payment-result.controller';
import { RabbitMqconfigModule } from 'src/rabbit-mqconfig/rabbit-mqconfig.module';
import { RabbitMQConfigService } from 'src/rabbit-mqconfig/rabbit-mqconfig.service';

@Module({
  imports: [
    RabbitMqconfigModule, // ✅ Ensure this is imported
    ClientsModule.registerAsync([
      {
        name: 'PAYMENT_RESULT_SERVICE',
        imports: [RabbitMqconfigModule], // ✅ Ensure RabbitMQConfigModule is included here
        useFactory: (configService: RabbitMQConfigService) =>
          configService.createRmqOptions('payment-result-queue'),
        inject: [RabbitMQConfigService], // ✅ Ensure it's properly injected
      },
    ]),
  ],
  controllers: [PaymentResultController],
  exports: [ClientsModule],
})
export class PaymentResultModule {}
