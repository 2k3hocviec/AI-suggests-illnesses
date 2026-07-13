import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlatformStatsService {
  constructor(private readonly prisma: PrismaService) {}

  /*Lấy số lượng người dùng*/
  async getPublicStats() {
    const [trustedUsers, doctors, specialties] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.doctor.count({
        where: {
          status: 'ACTIVE',
        },
      }),
      this.prisma.specialty.count(),
    ]);

    return {
      trustedUsers,
      doctors,
      specialties,
    };
  }
}
