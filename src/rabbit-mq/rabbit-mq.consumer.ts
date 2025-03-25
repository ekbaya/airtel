import { Injectable, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';
import { RabbitMQService } from './rabbit-mq.service';

@Injectable()
export class RabbitMQConsumer implements OnModuleInit {
  constructor(private readonly rabbitMQService: RabbitMQService) {}

  async onModuleInit() {
    await this.rabbitMQService.consumePaymentResults(this.handleMessage);
  }

  private handleMessage = (message: amqp.ConsumeMessage | null) => {
    if (message) {
      const content = message.content.toString();
      console.log('Received payment result:', JSON.parse(content));
      // Process payment result message here
    }
  };
}
