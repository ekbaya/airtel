import { Module } from '@nestjs/common';
import { RabbitMQService } from './rabbit-mq.service';
import { ConfigModule } from '@nestjs/config';
import { RabbitMQConsumer } from './rabbit-mq.consumer';

@Module({
  imports: [ConfigModule],
  providers: [RabbitMQService, RabbitMQConsumer],
  exports: [RabbitMQService],
})
export class RabbitMqModule {}
