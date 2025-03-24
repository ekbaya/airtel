import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { AirtelModule } from 'src/airtel/airtel.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [AirtelModule, ConfigModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
