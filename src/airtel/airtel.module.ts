import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config/dist';
import { CacheModule } from '@nestjs/cache-manager';
import * as memoryStore from 'cache-manager-memory-store';

import { AirtelService } from './airtel.service';
import { AirtelController } from './airtel.controller';

@Module({
  imports: [
    HttpModule,
    ConfigModule.forRoot(),
    CacheModule.register({
      isGlobal: true,
      store: memoryStore,
    }),
  ],
  controllers: [AirtelController],
  providers: [AirtelService],
  exports: [AirtelService],
})
export class AirtelModule {}
