import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        streetAddress: true,
        address: true,
        gender: true,
        role: true,
        isEnabled: true,
        dateOfBirth: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async listUsersForAdmin(
    adminId: number,
    options: { search?: string; page?: number; limit?: number },
  ) {
    await this.assertAdmin(adminId);

    const page = Math.max(options.page ?? 1, 1);
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
    const where = options.search
      ? {
          OR: [
            {
              fullName: {
                contains: options.search,
                mode: 'insensitive' as const,
              },
            },
            {
              email: {
                contains: options.search,
                mode: 'insensitive' as const,
              },
            },
            {
              phoneNumber: {
                contains: options.search,
                mode: 'insensitive' as const,
              },
            },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          fullName: true,
          email: true,
          phoneNumber: true,
          address: true,
          role: true,
          isEnabled: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              chatSessions: true,
              chatMessages: true,
              consultationHistories: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getAdminOverview(
    adminId: number,
    activityRange: { from?: string; to?: string } = {},
  ) {
    await this.assertAdmin(adminId);

    const { startDate, endDate } = this.resolveActivityRange(activityRange);

    const [
      totalUsers,
      enabledUsers,
      disabledUsers,
      totalChatSessions,
      totalMessages,
      modelRequests,
      adminUsers,
      normalUsers,
      recentUsers,
      recentMessages,
      consultationHistories,
      assistantMessages,
      specialtyGroups,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isEnabled: true } }),
      this.prisma.user.count({ where: { isEnabled: false } }),
      this.prisma.chatSession.count(),
      this.prisma.chatMessage.count(),
      this.prisma.consultationHistory.count(),
      this.prisma.user.count({ where: { role: UserRole.ADMIN } }),
      this.prisma.user.count({ where: { role: UserRole.USER } }),
      this.prisma.user.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          createdAt: true,
        },
      }),
      this.prisma.chatMessage.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          createdAt: true,
        },
      }),
      this.prisma.consultationHistory.findMany({
        select: {
          extractedSymptoms: true,
          recommendedSpecialty: {
            select: {
              code: true,
              name: true,
            },
          },
        },
      }),
      this.prisma.chatMessage.findMany({
        where: {
          role: 'ASSISTANT',
          metadata: {
            not: undefined,
          },
        },
        select: {
          metadata: true,
        },
      }),
      this.prisma.consultationHistory.groupBy({
        by: ['recommendedSpecialtyId'],
        where: {
          recommendedSpecialtyId: {
            not: null,
          },
        },
        _count: {
          _all: true,
        },
        orderBy: {
          _count: {
            recommendedSpecialtyId: 'desc',
          },
        },
        take: 5,
      }),
    ]);
    const specialtyIds = specialtyGroups
      .map((item) => item.recommendedSpecialtyId)
      .filter((id): id is number => typeof id === 'number');
    const specialties = specialtyIds.length
      ? await this.prisma.specialty.findMany({
          where: {
            id: {
              in: specialtyIds,
            },
          },
          select: {
            id: true,
            code: true,
            name: true,
          },
        })
      : [];

    return {
      totals: {
        users: totalUsers,
        enabledUsers,
        disabledUsers,
        chatSessions: totalChatSessions,
        messages: totalMessages,
        modelRequests,
      },
      roleBreakdown: [
        { label: 'Admin', value: adminUsers },
        { label: 'Người dùng', value: normalUsers },
      ],
      statusBreakdown: [
        { label: 'Đang hoạt động', value: enabledUsers },
        { label: 'Đã vô hiệu', value: disabledUsers },
      ],
      dailyActivity: this.buildDailyActivity(startDate, recentUsers, recentMessages),
      ai: this.buildAiStats(
        consultationHistories,
        assistantMessages,
        specialtyGroups,
        specialties,
      ),
    };
  }

  async setUserEnabled(adminId: number, userId: number, isEnabled: boolean) {
    await this.assertAdmin(adminId);

    if (adminId === userId && !isEnabled) {
      throw new BadRequestException('Admin không thể tự vô hiệu hóa tài khoản');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { isEnabled },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isEnabled: true,
        updatedAt: true,
      },
    });
  }

  async assertAdmin(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        isEnabled: true,
      },
    });

    if (!user?.isEnabled || user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin access required');
    }
  }

  private buildAiStats(
    consultationHistories: Array<{
      extractedSymptoms: unknown;
      recommendedSpecialty: { code: string; name: string } | null;
    }>,
    assistantMessages: Array<{ metadata: unknown }>,
    specialtyGroups: Array<{
      recommendedSpecialtyId: number | null;
      _count: { _all: number };
    }>,
    specialties: Array<{ id: number; code: string; name: string }>,
  ) {
    const symptomCounts = new Map<string, number>();
    let unrecognizedCases = 0;

    for (const history of consultationHistories) {
      const symptoms = Array.isArray(history.extractedSymptoms)
        ? history.extractedSymptoms
        : [];

      if (!symptoms.length && !history.recommendedSpecialty) {
        unrecognizedCases += 1;
      }

      for (const symptom of symptoms) {
        if (!symptom || typeof symptom !== 'object') {
          continue;
        }

        const name = (symptom as { name?: unknown }).name;
        if (typeof name !== 'string' || !name.trim()) {
          continue;
        }

        const key = name.trim();
        symptomCounts.set(key, (symptomCounts.get(key) ?? 0) + 1);
      }
    }

    const sourceCounts = new Map<string, number>();
    for (const message of assistantMessages) {
      if (!message.metadata || typeof message.metadata !== 'object') {
        continue;
      }

      const source = (message.metadata as { analysisSource?: unknown })
        .analysisSource;
      if (source !== 'NER' && source !== 'Gemini') {
        continue;
      }

      sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
    }

    return {
      totalConsultations: consultationHistories.length,
      unrecognizedCases,
      topSymptoms: [...symptomCounts.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count })),
      topSpecialties: specialtyGroups
        .map((item) => {
          const specialty = specialties.find(
            (candidate) => candidate.id === item.recommendedSpecialtyId,
          );

          if (!specialty) {
            return null;
          }

          return {
            code: specialty.code,
            name: specialty.name,
            count: item._count._all,
          };
        })
        .filter(
          (
            item,
          ): item is {
            code: string;
            name: string;
            count: number;
          } => Boolean(item),
        ),
      sourceBreakdown: [
        { label: 'NER', value: sourceCounts.get('NER') ?? 0 },
        { label: 'Gemini', value: sourceCounts.get('Gemini') ?? 0 },
      ],
    };
  }

  private buildDailyActivity(
    startDate: Date,
    users: Array<{ createdAt: Date }>,
    messages: Array<{ createdAt: Date }>,
  ) {
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(startDate);
      day.setUTCDate(startDate.getUTCDate() + index);
      const key = day.toISOString().slice(0, 10);

      return {
        date: key,
        users: users.filter(
          (item) => item.createdAt.toISOString().slice(0, 10) === key,
        ).length,
        messages: messages.filter(
          (item) => item.createdAt.toISOString().slice(0, 10) === key,
        ).length,
      };
    });
  }

  private resolveActivityRange(range: { from?: string; to?: string }) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const defaultStart = new Date(today);
    defaultStart.setUTCDate(defaultStart.getUTCDate() - 6);

    const requestedStart = this.parseDateOnly(range.from);
    const requestedEnd = this.parseDateOnly(range.to);
    const startDate = requestedStart ?? defaultStart;
    const endDate = requestedEnd ?? new Date(startDate);

    if (!requestedEnd) {
      endDate.setUTCDate(endDate.getUTCDate() + 6);
    }

    const maxEndDate = new Date(startDate);
    maxEndDate.setUTCDate(maxEndDate.getUTCDate() + 6);

    if (endDate < startDate) {
      return {
        startDate: defaultStart,
        endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1),
      };
    }

    return {
      startDate,
      endDate:
        endDate > maxEndDate
          ? new Date(maxEndDate.getTime() + 24 * 60 * 60 * 1000 - 1)
          : new Date(endDate.getTime() + 24 * 60 * 60 * 1000 - 1),
    };
  }

  private parseDateOnly(value?: string) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return null;
    }

    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
}
