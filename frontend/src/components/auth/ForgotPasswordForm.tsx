'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, Mail } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  forgotPassword,
  resetPassword,
} from '@/lib/auth-api';
import { AuthCard } from './AuthCard';
import { FormField } from './FormField';
import { PasswordField } from './PasswordField';

const forgotPasswordSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
});

const resetPasswordSchema = z
  .object({
    email: z.string().email('Email không hợp lệ'),
    otp: z
      .string()
      .trim()
      .regex(/^\d{6}$/, 'OTP gồm 6 chữ số'),
    newPassword: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
    confirmPassword: z.string().min(6, 'Vui lòng xác nhận mật khẩu'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  });

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export function ForgotPasswordForm() {
  const router = useRouter();
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [notice, setNotice] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const requestForm = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const resetForm = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      email: '',
      otp: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  async function onRequestOtp(values: ForgotPasswordValues) {
    setNotice(null);
    setServerError(null);
    setIsSubmitting(true);

    try {
      await forgotPassword({ email: values.email });
      resetForm.setValue('email', values.email);
      setStep('reset');
      setNotice('Nếu email tồn tại, mã OTP đã được gửi tới hộp thư của bạn.');
    } catch (error) {
      setServerError(
        error instanceof Error
          ? error.message
          : 'Không thể gửi OTP. Vui lòng thử lại.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onResetPassword(values: ResetPasswordValues) {
    setNotice(null);
    setServerError(null);
    setIsSubmitting(true);

    try {
      await resetPassword({
        email: values.email,
        otp: values.otp.trim(),
        newPassword: values.newPassword,
      });
      router.push('/login?reset=1');
    } catch (error) {
      setServerError(
        error instanceof Error
          ? error.message
          : 'Không thể đặt lại mật khẩu. Vui lòng thử lại.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="w-full">
      <AuthCard>
        <div className="mb-5">
          <h2 className="text-base font-bold text-ink lg:text-xl">
            Quên mật khẩu
          </h2>
          <p className="mt-1 text-xs text-slate-500 lg:text-sm">
            Nhập email để nhận OTP và tạo mật khẩu mới
          </p>
        </div>

        {step === 'request' ? (
          <form
            className="space-y-3.5 lg:space-y-5"
            onSubmit={requestForm.handleSubmit(onRequestOtp)}
          >
            <FormField
              label="Email"
              icon={Mail}
              type="email"
              autoComplete="email"
              placeholder="Nhập email của bạn"
              error={requestForm.formState.errors.email?.message}
              {...requestForm.register('email')}
            />

            {serverError ? (
              <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">
                {serverError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-1 h-9 w-full rounded-md bg-brand-600 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300 lg:h-11 lg:text-sm"
            >
              {isSubmitting ? 'Đang gửi OTP...' : 'Gửi OTP'}
            </button>
          </form>
        ) : (
          <form
            className="space-y-3.5 lg:space-y-5"
            onSubmit={resetForm.handleSubmit(onResetPassword)}
          >
            {notice ? (
              <p className="rounded-md bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                {notice}
              </p>
            ) : null}

            <FormField
              label="Email"
              icon={Mail}
              type="email"
              autoComplete="email"
              placeholder="Nhập email của bạn"
              error={resetForm.formState.errors.email?.message}
              {...resetForm.register('email')}
            />

            <FormField
              label="Mã OTP"
              icon={KeyRound}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="Nhập mã 6 chữ số"
              error={resetForm.formState.errors.otp?.message}
              {...resetForm.register('otp')}
            />

            <PasswordField
              label="Mật khẩu mới"
              autoComplete="new-password"
              placeholder="Tạo mật khẩu mới"
              error={resetForm.formState.errors.newPassword?.message}
              {...resetForm.register('newPassword')}
            />

            <PasswordField
              label="Xác nhận mật khẩu"
              autoComplete="new-password"
              placeholder="Nhập lại mật khẩu mới"
              error={resetForm.formState.errors.confirmPassword?.message}
              {...resetForm.register('confirmPassword')}
            />

            {serverError ? (
              <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">
                {serverError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-1 h-9 w-full rounded-md bg-brand-600 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300 lg:h-11 lg:text-sm"
            >
              {isSubmitting ? 'Đang đặt lại mật khẩu...' : 'Đặt lại mật khẩu'}
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                setStep('request');
                setNotice(null);
                setServerError(null);
              }}
              className="w-full text-xs font-semibold text-slate-500 transition hover:text-brand-600 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              Dùng email khác
            </button>
          </form>
        )}
      </AuthCard>

      <p className="mt-6 text-center text-xs text-slate-500">
        Nhớ mật khẩu?{' '}
        <Link
          href="/login"
          className="font-semibold text-brand-600 transition hover:text-brand-700"
        >
          Đăng nhập
        </Link>
      </p>
    </div>
  );
}
