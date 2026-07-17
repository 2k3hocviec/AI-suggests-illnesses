import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdministrativeUnitsService {
  constructor(private readonly prisma: PrismaService) {}

  listProvinces() {
    return this.prisma.province.findMany({
      select: {
        code: true,
        name: true,
        divisionType: true,
        codename: true,
      },
      orderBy: {
        code: 'asc',
      },
    });
  }

  listDistricts(provinceCode: number) {
    if (!Number.isInteger(provinceCode)) {
      throw new BadRequestException('provinceCode không hợp lệ');
    }

    return this.prisma.district.findMany({
      where: {
        provinceCode,
      },
      select: {
        code: true,
        name: true,
        divisionType: true,
        codename: true,
        provinceCode: true,
      },
      orderBy: {
        code: 'asc',
      },
    });
  }

  listWards(districtCode: number) {
    if (!Number.isInteger(districtCode)) {
      throw new BadRequestException('districtCode không hợp lệ');
    }

    return this.prisma.ward.findMany({
      where: {
        districtCode,
      },
      select: {
        code: true,
        name: true,
        divisionType: true,
        codename: true,
        districtCode: true,
        provinceCode: true,
      },
      orderBy: {
        code: 'asc',
      },
    });
  }
}
