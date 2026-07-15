import { Module } from '@nestjs/common';
import { AdministrativeUnitsController } from './administrative-units.controller';
import { AdministrativeUnitsService } from './administrative-units.service';

@Module({
  controllers: [AdministrativeUnitsController],
  providers: [AdministrativeUnitsService],
  exports: [AdministrativeUnitsService],
})
export class AdministrativeUnitsModule {}
