import { Controller, Get, ParseIntPipe, Query } from '@nestjs/common';
import { AdministrativeUnitsService } from './administrative-units.service';

@Controller('administrative-units')
export class AdministrativeUnitsController {
  constructor(
    private readonly administrativeUnitsService: AdministrativeUnitsService,
  ) {}

  @Get('provinces')
  listProvinces() {
    return this.administrativeUnitsService.listProvinces();
  }

  @Get('communes')
  listCommunes(@Query('provinceCode', ParseIntPipe) provinceCode: number) {
    return this.administrativeUnitsService.listCommunes(provinceCode);
  }
}
