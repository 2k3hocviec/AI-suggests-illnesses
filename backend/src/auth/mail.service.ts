import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

type MailOptions = {
  to: string;
  subject: string;
  text: string;
  failWhenUnconfigured?: boolean;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  async sendPasswordResetOtp(email: string, otp: string) {
    const ttlMinutes = this.config.get<number>('passwordResetOtpTtlMinutes', 10);

    await this.sendMail({
      to: email,
      subject: 'Mã OTP đặt lại mật khẩu',
      text: this.buildOtpText(otp, ttlMinutes),
      failWhenUnconfigured: this.isProduction(),
    });
  }

  private isEmailConfigured() {
    return Boolean(
      this.config.get<string>('resendApiKey') ||
        (this.config.get<string>('smtp.host') &&
          this.config.get<string>('smtp.user') &&
          this.config.get<string>('smtp.pass')),
    );
  }

  private async sendMail({
    to,
    subject,
    text,
    failWhenUnconfigured = false,
  }: MailOptions) {
    const resendApiKey = this.config.get<string>('resendApiKey');
    if (resendApiKey) {
      await this.sendWithResendApi({ to, subject, text }, resendApiKey);
      return;
    }

    if (!this.isEmailConfigured()) {
      if (failWhenUnconfigured || this.isProduction()) {
        throw new InternalServerErrorException(
          'Email delivery is not configured',
        );
      }
      this.logger.warn(
        `Email chưa được cấu hình. Nội dung gửi đến ${to}: ${text}`,
      );
      return;
    }

    await this.sendWithSmtp({ to, subject, text });
  }

  private async sendWithResendApi(
    { to, subject, text }: MailOptions,
    apiKey: string,
  ) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.config.get<string>('smtp.from'),
        to,
        subject,
        text,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Resend API gửi OTP thất bại: ${errorText}`);
      throw new InternalServerErrorException('Không gửi được email OTP');
    }
  }

  private async sendWithSmtp({ to, subject, text }: MailOptions) {
    const transporter = nodemailer.createTransport({
      host: this.config.get<string>('smtp.host'),
      port: this.config.get<number>('smtp.port', 587),
      secure: this.config.get<boolean>('smtp.secure', false),
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
      auth: {
        user: this.config.get<string>('smtp.user'),
        pass: this.config.get<string>('smtp.pass'),
      },
    });

    await transporter.sendMail({
      from: this.config.get<string>('smtp.from'),
      to,
      subject,
      text,
    });
  }

  private buildOtpText(otp: string, ttlMinutes: number) {
    return `Mã OTP của bạn là ${otp}. Mã có hiệu lực trong ${ttlMinutes} phút.`;
  }

  private isProduction() {
    return this.config.get<string>('nodeEnv') === 'production';
  }
}
