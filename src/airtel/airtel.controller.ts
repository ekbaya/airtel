import { Controller, Get } from '@nestjs/common';
import { AirtelService } from './airtel.service';

@Controller('airtel')
export class AirtelController {
  constructor(private readonly airtelService: AirtelService) {}

  @Get('token')
  async getToken() {
    return { token: await this.airtelService.getAccessToken() };
  }
}
