import { Module } from '@nestjs/common';
import { RabbitMQConfigService } from './rabbit-mqconfig.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [RabbitMQConfigService],
  exports: [RabbitMQConfigService],
})
export class RabbitMqconfigModule {}
