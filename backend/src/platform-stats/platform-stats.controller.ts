import { Controller, Get } from '@nestjs/common';
import { PlatformStatsService } from './platform-stats.service';

@Controller('platform-stats')
export class PlatformStatsController {
  constructor(private readonly platformStatsService: PlatformStatsService) {}

  @Get()
  getPublicStats() {
    return this.platformStatsService.getPublicStats();
  }
}
