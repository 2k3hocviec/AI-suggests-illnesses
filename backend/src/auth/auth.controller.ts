import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AuthenticatedUser } from './auth.types';
import { CurrentUser } from './current-user.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(
      dto,
      this.getRequestContext(request),
    );
    this.setRefreshCookie(
      response,
      result.refreshToken,
      result.refreshTokenExpiresAt,
    );
    return this.withoutRefreshToken(result);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getProfile(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('change-password')
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.id, dto);
  }

  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('refresh')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.refresh(
      this.getRefreshTokenFromCookie(request),
      this.getRequestContext(request),
    );
    this.setRefreshCookie(
      response,
      result.refreshToken,
      result.refreshTokenExpiresAt,
    );
    return this.withoutRefreshToken(result);
  }

  @Post('logout')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.logout(
      this.getRefreshTokenFromCookie(request),
    );
    this.clearRefreshCookie(response);
    return result;
  }

  private setRefreshCookie(
    response: Response,
    refreshToken: string,
    expires: Date,
  ) {
    response.cookie(this.getRefreshCookieName(), refreshToken, {
      httpOnly: true,
      secure: this.config.get<string>('nodeEnv') === 'production',
      sameSite: 'lax',
      expires,
      path: '/api/v1/auth',
    });
  }

  private clearRefreshCookie(response: Response) {
    response.clearCookie(this.getRefreshCookieName(), {
      httpOnly: true,
      secure: this.config.get<string>('nodeEnv') === 'production',
      sameSite: 'lax',
      path: '/api/v1/auth',
    });
  }

  private getRefreshTokenFromCookie(request: Request) {
    const cookies = request.cookies as Record<string, string> | undefined;
    return cookies?.[this.getRefreshCookieName()];
  }

  private getRefreshCookieName() {
    return this.config.get<string>('refreshTokenCookieName', 'refreshToken');
  }

  private getRequestContext(request: Request) {
    return {
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip,
    };
  }

  private withoutRefreshToken<T extends { refreshToken: string }>(
    result: T,
  ): Omit<T, 'refreshToken'> {
    const { refreshToken: _refreshToken, ...safeResult } = result;
    return safeResult;
  }
}
