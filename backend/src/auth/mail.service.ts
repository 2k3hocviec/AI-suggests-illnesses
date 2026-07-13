import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  async sendPasswordResetOtp(email: string, otp: string) {
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
      from: this.config.get<string>('smtp.from'),
      to: email,
      subject: 'Mã OTP đặt lại mật khẩu',
      text: `Mã OTP của bạn là ${otp}. Mã có hiệu lực trong ${this.config.get<number>(
        'passwordResetOtpTtlMinutes',
        10,
      )} phut.`,
    });
  }
}
