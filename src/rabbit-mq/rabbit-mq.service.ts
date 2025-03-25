import * as amqp from 'amqplib';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface RabbitMQConfig {
  url: string;
  exchange: string;
  queue: string;
}

@Injectable()
export class RabbitMQService {
  private connection: amqp.ChannelModel;
  private channel: amqp.Channel;

  constructor(private readonly configService: ConfigService) {}

  private getConfig(): RabbitMQConfig {
    return {
      url: this.configService.get<string>(
        'RABBITMQ_URL',
        'amqp://guest:guest@localhost:5672',
      ),
      exchange: this.configService.get<string>(
        'RABBITMQ_EXCHANGE',
        'payment-results',
      ),
      queue: this.configService.get<string>('RABBITMQ_QUEUE', 'payment-result'),
    };
  }

  async connect() {
    try {
      const config = this.getConfig();

      this.connection = await amqp.connect(config.url);

      this.channel = await this.connection.createChannel();

      await this.channel.assertExchange(config.exchange, 'topic', {
        durable: true,
      });

      await this.channel.assertQueue(config.queue, { durable: true });

      console.log('RabbitMQ connection established');
    } catch (error) {
      console.error('Failed to connect to RabbitMQ', error);
      throw error;
    }
  }

  publishPaymentResult = async (routingKey: string, message: any) => {
    if (!this.channel) {
      await this.connect();
    }

    try {
      const config = this.getConfig();

      const published = this.channel.publish(
        config.exchange,
        routingKey, // routing key
        Buffer.from(JSON.stringify(message)),
        {
          persistent: true,
          timestamp: Date.now(),
          messageId: this.generateMessageId(),
        },
      );

      if (published) {
        console.log(`Published payment result with routing key: ${routingKey}`);
      } else {
        console.log('Not published*********************');
      }
    } catch (error) {
      console.error('Failed to publish message', error);
      throw error;
    }
  };

  async consumePaymentResults(
    callback: (message: amqp.ConsumeMessage | null) => void,
  ) {
    if (!this.channel) {
      await this.connect();
    }

    const config = this.getConfig();

    await this.channel.bindQueue(
      config.queue,
      config.exchange,
      'payment.#', // Wildcard routing key pattern
    );

    await this.channel.consume(config.queue, (message) => {
      if (message) {
        try {
          callback(message);
          this.channel.ack(message);
        } catch (error) {
          console.error('Error processing message', error);
          this.channel.nack(message, false, false);
        }
      }
    });
  }

  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async close() {
    if (this.connection) {
      await this.connection.close();
    }
  }
}
