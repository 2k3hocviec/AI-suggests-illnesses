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

  async getAdminOverview(adminId: number) {
    await this.assertAdmin(adminId);

    const since = new Date();
    since.setDate(since.getDate() - 6);
    since.setHours(0, 0, 0, 0);

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
            gte: since,
          },
        },
        select: {
          createdAt: true,
        },
      }),
      this.prisma.chatMessage.findMany({
        where: {
          createdAt: {
            gte: since,
          },
        },
        select: {
          createdAt: true,
        },
      }),
    ]);

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
      dailyActivity: this.buildDailyActivity(since, recentUsers, recentMessages),
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

  private async assertAdmin(userId: number) {
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

  private buildDailyActivity(
    startDate: Date,
    users: Array<{ createdAt: Date }>,
    messages: Array<{ createdAt: Date }>,
  ) {
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + index);
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
}
