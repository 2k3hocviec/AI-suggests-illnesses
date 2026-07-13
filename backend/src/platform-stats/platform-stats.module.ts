import { Module } from '@nestjs/common';
import { PlatformStatsController } from './platform-stats.controller';
import { PlatformStatsService } from './platform-stats.service';

@Module({
  controllers: [PlatformStatsController],
  providers: [PlatformStatsService],
})
export class PlatformStatsModule {}
