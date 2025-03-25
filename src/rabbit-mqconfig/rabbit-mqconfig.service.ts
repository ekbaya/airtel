import { Injectable } from '@nestjs/common';
import { Transport, RmqOptions } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';

// RabbitMQ Configuration Service
@Injectable()
export class RabbitMQConfigService {
  constructor(private configService: ConfigService) {}

  createRmqOptions(queue: string): RmqOptions {
    return {
      transport: Transport.RMQ,
      options: {
        urls: [
          this.configService.get<string>(
            'RABBITMQ_URL',
            'amqp://localhost:5672',
          ),
        ],
        queue: queue,
        queueOptions: {
          durable: true, // Ensure queue survives broker restart
          arguments: {
            'x-message-ttl': 86400000, // 24 hours message TTL
          },
        },
        prefetchCount: 1, // Process one message at a time
        noAck: false, // Enable manual acknowledgment
      },
    };
  }
}
