import { Controller, Get, Post, Body } from '@nestjs/common';
import { AirtelService } from './airtel.service';

@Controller('airtel')
export class AirtelController {
  constructor(private readonly airtelService: AirtelService) {}

  @Get('token')
  async getToken() {
    return { token: await this.airtelService.getAccessToken() };
  }

  @Post('api-request')
  async makeApiRequest(
    @Body('endpoint') endpoint: string,
    @Body('method') method: 'GET' | 'POST' = 'GET',
    @Body('data') data?: any,
  ) {
    return this.airtelService.makeApiRequest(endpoint, method, data);
  }
}
