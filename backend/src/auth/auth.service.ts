import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes, randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { JwtUserPayload, PublicUser, RequestContext } from './auth.types';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { MailService } from './mail.service';
import { AdministrativeUnitsService } from '../administrative-units/administrative-units.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly mailService: MailService,
    private readonly administrativeUnits: AdministrativeUnitsService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });

    if (existing) {
      throw new ConflictException('Email đã tồn tại');
    }

    const password = await this.hashValue(dto.password);
    const address = await this.resolveRegisterAddress(dto);
    const user = await this.prisma.user.create({
      data: {
        fullName: dto.fullName.trim(),
        email,
        password,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        gender: dto.gender,
        phoneNumber: dto.phoneNumber?.trim() || undefined,
        streetAddress: address.streetAddress,
        address: address.address,
        provinceCode: address.provinceCode,
        districtCode: address.districtCode,
        wardCode: address.wardCode,
      },
    });

    return {
      message: 'Account registered successfully',
      user: this.toPublicUser(user),
    };
  }

  private async resolveRegisterAddress(dto: RegisterDto) {
    const [districts, wards] = await Promise.all([
      this.administrativeUnits.listDistricts(dto.provinceCode),
      this.administrativeUnits.listWards(dto.districtCode),
    ]);
    const district = districts.find((item) => item.code === dto.districtCode);
    const ward = wards.find((item) => item.code === dto.wardCode);

    if (!district || !ward || ward.provinceCode !== dto.provinceCode) {
      throw new BadRequestException('Địa chỉ hành chính không hợp lệ');
    }

    const province = (await this.administrativeUnits.listProvinces()).find(
      (item) => item.code === dto.provinceCode,
    );

    if (!province) {
      throw new BadRequestException('Tỉnh/thành không hợp lệ');
    }

    return {
      streetAddress: dto.streetAddress.trim(),
      address: `${dto.streetAddress.trim()}, ${ward.name}, ${district.name}, ${province.name}`,
      provinceCode: province.code,
      districtCode: district.code,
      wardCode: ward.code,
    };
  }

  async login(dto: LoginDto, context: RequestContext) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user?.password) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.buildAuthResponse(user, context);
  }

  async getProfile(userId: number) {
    const user = await this.findUserById(userId);
    return this.toPublicUser(user);
  }

  async updateProfile(userId: number, dto: UpdateProfileDto) {
    const currentUser = await this.findUserById(userId);
    const email = dto.email?.trim().toLowerCase();

    if (email && email !== currentUser.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email },
      });

      if (existing) {
        throw new ConflictException('Email đã tồn tại');
      }
    }

    const address = await this.resolveUpdateAddress(currentUser, dto);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        fullName: dto.fullName?.trim() || undefined,
        email,
        phoneNumber:
          dto.phoneNumber !== undefined
            ? dto.phoneNumber.trim() || null
            : undefined,
        dateOfBirth:
          dto.dateOfBirth !== undefined
            ? dto.dateOfBirth
              ? new Date(dto.dateOfBirth)
              : null
            : undefined,
        gender: dto.gender,
        streetAddress: address?.streetAddress,
        address: address?.address,
        provinceCode: address?.provinceCode,
        districtCode: address?.districtCode,
        wardCode: address?.wardCode,
      },
    });

    return this.toPublicUser(user);
  }

  private async resolveUpdateAddress(user: User, dto: UpdateProfileDto) {
    const shouldUpdateAddress =
      dto.streetAddress !== undefined ||
      dto.provinceCode !== undefined ||
      dto.districtCode !== undefined ||
      dto.wardCode !== undefined;

    if (!shouldUpdateAddress) {
      return null;
    }

    const streetAddress = dto.streetAddress?.trim() || user.streetAddress;
    const provinceCode = dto.provinceCode ?? user.provinceCode;
    const districtCode = dto.districtCode ?? user.districtCode;
    const wardCode = dto.wardCode ?? user.wardCode;

    if (!streetAddress || !provinceCode || !districtCode || !wardCode) {
      throw new BadRequestException('Vui lòng nhập đầy đủ địa chỉ');
    }

    const [districts, wards] = await Promise.all([
      this.administrativeUnits.listDistricts(provinceCode),
      this.administrativeUnits.listWards(districtCode),
    ]);
    const district = districts.find((item) => item.code === districtCode);
    const ward = wards.find((item) => item.code === wardCode);

    if (!district || !ward || ward.provinceCode !== provinceCode) {
      throw new BadRequestException('Địa chỉ hành chính không hợp lệ');
    }

    const province = (await this.administrativeUnits.listProvinces()).find(
      (item) => item.code === provinceCode,
    );

    if (!province) {
      throw new BadRequestException('Tỉnh/thành không hợp lệ');
    }

    return {
      streetAddress,
      address: `${streetAddress}, ${ward.name}, ${district.name}, ${province.name}`,
      provinceCode: province.code,
      districtCode: district.code,
      wardCode: ward.code,
    };
  }

  async changePassword(userId: number, dto: ChangePasswordDto) {
    const user = await this.findUserById(userId);

    if (!user.password) {
      throw new BadRequestException('This account does not have a password');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.currentPassword,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const password = await this.hashValue(dto.newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password },
    });

    return { message: 'Password changed successfully' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      return { message: 'If the email exists, an OTP has been sent' };
    }

    const otp = this.generateOtp();
    const otpHash = await this.hashValue(otp);
    const ttlMinutes = this.config.get<number>(
      'passwordResetOtpTtlMinutes',
      10,
    );
    const expires = new Date(Date.now() + ttlMinutes * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetOtpHash: otpHash,
        passwordResetExpires: expires,
        passwordResetAttempts: 0,
      },
    });

    await this.mailService.sendPasswordResetOtp(email, otp);

    return { message: 'If the email exists, an OTP has been sent' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user?.passwordResetOtpHash || !user.passwordResetExpires) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    if (user.passwordResetExpires.getTime() < Date.now()) {
      await this.clearResetOtp(user.id);
      throw new BadRequestException('Invalid or expired OTP');
    }

    if (user.passwordResetAttempts >= 5) {
      await this.clearResetOtp(user.id);
      throw new BadRequestException('Too many invalid OTP attempts');
    }

    const isOtpValid = await bcrypt.compare(dto.otp, user.passwordResetOtpHash);
    if (!isOtpValid) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetAttempts: {
            increment: 1,
          },
        },
      });
      throw new BadRequestException('Invalid or expired OTP');
    }

    const password = await this.hashValue(dto.newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          password,
          passwordResetOtpHash: null,
          passwordResetExpires: null,
          passwordResetAttempts: 0,
        },
      }),
      this.prisma.authSession.updateMany({
        where: {
          userId: user.id,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      }),
    ]);

    return { message: 'Password reset successfully' };
  }

  async refresh(refreshToken: string | undefined, context: RequestContext) {
    if (!refreshToken) {
      throw new UnauthorizedException('Missing refresh token');
    }

    const sessions = await this.prisma.authSession.findMany({
      where: {
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    for (const session of sessions) {
      const isValid = await bcrypt.compare(
        refreshToken,
        session.refreshTokenHash,
      );

      if (!isValid) {
        continue;
      }

      await this.prisma.authSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });

      return this.buildAuthResponse(session.user, context);
    }

    throw new UnauthorizedException('Invalid or expired refresh token');
  }

  async logout(refreshToken: string | undefined) {
    if (!refreshToken) {
      return { message: 'Logged out successfully' };
    }

    const sessions = await this.prisma.authSession.findMany({
      where: { revokedAt: null },
      select: {
        id: true,
        refreshTokenHash: true,
      },
    });

    for (const session of sessions) {
      const isValid = await bcrypt.compare(
        refreshToken,
        session.refreshTokenHash,
      );

      if (isValid) {
        await this.prisma.authSession.update({
          where: { id: session.id },
          data: { revokedAt: new Date() },
        });
        break;
      }
    }

    return { message: 'Logged out successfully' };
  }

  private async findUserById(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  private async clearResetOtp(userId: number) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordResetOtpHash: null,
        passwordResetExpires: null,
        passwordResetAttempts: 0,
      },
    });
  }

  private async buildAuthResponse(user: User, context: RequestContext) {
    const payload: JwtUserPayload = {
      sub: user.id,
      email: user.email,
    };
    const accessToken = await this.jwtService.signAsync(payload);
    const refreshToken = this.generateRefreshToken();
    const refreshTokenHash = await this.hashValue(refreshToken);
    const refreshTokenTtlDays = this.config.get<number>(
      'refreshTokenTtlDays',
      7,
    );
    const refreshTokenExpiresAt = new Date(
      Date.now() + refreshTokenTtlDays * 24 * 60 * 60 * 1000,
    );

    await this.prisma.authSession.create({
      data: {
        userId: user.id,
        refreshTokenHash,
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
        expiresAt: refreshTokenExpiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      refreshTokenExpiresAt,
      user: this.toPublicUser(user),
    };
  }

  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      streetAddress: user.streetAddress,
      address: user.address,
      provinceCode: user.provinceCode,
      districtCode: user.districtCode,
      wardCode: user.wardCode,
      gender: user.gender,
      role: user.role,
      dateOfBirth: user.dateOfBirth,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private hashValue(value: string) {
    return bcrypt.hash(value, 12);
  }

  private generateOtp() {
    return randomInt(100000, 1000000).toString();
  }

  private generateRefreshToken() {
    return randomBytes(64).toString('base64url');
  }
}
