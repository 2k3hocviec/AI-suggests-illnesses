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

  listCommunes(provinceCode: number) {
    if (!Number.isInteger(provinceCode)) {
      throw new BadRequestException('provinceCode không hợp lệ');
    }

    return this.prisma.commune.findMany({
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

}
