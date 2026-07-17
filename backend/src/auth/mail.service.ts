import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  async sendPasswordResetOtp(email: string, otp: string) {
    const resendApiKey = this.config.get<string>('resendApiKey');
    const from = this.config.get<string>('smtp.from');
    const ttlMinutes = this.config.get<number>('passwordResetOtpTtlMinutes', 10);

    if (resendApiKey) {
      await this.sendWithResendApi(email, otp, ttlMinutes, resendApiKey, from);
      return;
    }

    const host = this.config.get<string>('smtp.host');
    const user = this.config.get<string>('smtp.user');
    const pass = this.config.get<string>('smtp.pass');

    if (!host || !user || !pass) {
      this.logger.warn(
        `SMTP chưa được cấu hình. OTP đặt lại mật khẩu cho ${email}: ${otp}`,
      );
      return;
    }

    const transporter = nodemailer.createTransport({
      host,
      port: this.config.get<number>('smtp.port', 587),
      secure: this.config.get<boolean>('smtp.secure', false),
      auth: {
        user,
        pass,
      },
    });

    await transporter.sendMail({
      from,
      to: email,
      subject: 'Mã OTP đặt lại mật khẩu',
      text: this.buildOtpText(otp, ttlMinutes),
    });
  }

  private async sendWithResendApi(
    email: string,
    otp: string,
    ttlMinutes: number,
    apiKey: string,
    from?: string,
  ) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: email,
        subject: 'Mã OTP đặt lại mật khẩu',
        text: this.buildOtpText(otp, ttlMinutes),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Resend API gửi OTP thất bại: ${errorText}`);
      throw new Error('Không gửi được email OTP');
    }
  }

  private buildOtpText(otp: string, ttlMinutes: number) {
    return `Mã OTP của bạn là ${otp}. Mã có hiệu lực trong ${ttlMinutes} phút.`;
  }
}
