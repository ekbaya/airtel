import { Controller, Logger } from '@nestjs/common';
import {
  MessagePattern,
  Payload,
  Ctx,
  RmqContext,
} from '@nestjs/microservices';
import { Channel } from 'amqp-connection-manager';
import { Message } from 'amqplib';
import { CallbackTransactionData } from 'src/payments/dto';

@Controller()
export class PaymentResultController {
  private readonly logger = new Logger(PaymentResultController.name);

  @MessagePattern('payment.success')
  handlePaymentSuccess(
    @Payload() data: CallbackTransactionData,
    @Ctx() context: RmqContext,
  ) {
    try {
      // Process successful payment
      this.logger.log(`Successful payment: ${data.id}`);

      // Manually acknowledge the message
      const channel = context.getChannelRef() as Channel;
      const originalMsg = context.getMessage() as Message;
      channel.ack(originalMsg);
    } catch (error) {
      this.logger.error('Error processing payment success', error);
    }
  }

  @MessagePattern('payment.failure')
  handlePaymentFailure(
    @Payload() data: CallbackTransactionData,
    @Ctx() context: RmqContext,
  ) {
    try {
      // Process failed payment
      this.logger.log(`Failed payment: ${data.id}`);

      // Manually acknowledge the message
      const channel = context.getChannelRef() as Channel;
      const originalMsg = context.getMessage() as Message;
      channel.ack(originalMsg);
    } catch (error) {
      this.logger.error('Error processing payment failure', error);
    }
  }
}
