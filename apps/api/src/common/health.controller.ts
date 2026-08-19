import { Controller, Get } from '@nestjs/common';
import { query } from './db';

@Controller('health')
export class HealthController {
  @Get()
  health() {
    return { status: 'ok', service: 'wb-api', version: 'v0' };
  }

  @Get('ready')
  async ready() {
    await query('SELECT 1');
    return { status: 'ready', database: 'ok' };
  }
}
