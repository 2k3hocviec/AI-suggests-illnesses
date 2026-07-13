'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Mail } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { login } from '@/lib/auth-api';
import { AuthCard } from './AuthCard';
import { FormField } from './FormField';
import { PasswordField } from './PasswordField';

const loginSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isRegistered = searchParams.get('registered') === '1';
  const isPasswordReset = searchParams.get('reset') === '1';
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(values: LoginFormValues) {
    setServerError(null);
    setIsSubmitting(true);
    try {
      const response = await login(values);
      localStorage.setItem('accessToken', response.accessToken);
      router.push('/dashboard');
    } catch (error) {
      setServerError(
        error instanceof Error
          ? error.message
          : 'Không thể đăng nhập. Vui lòng thử lại.',
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
            Đăng nhập tài khoản
          </h2>
          <p className="mt-1 text-xs text-slate-500 lg:text-sm">
            Vui lòng nhập thông tin đăng nhập
          </p>
        </div>

        <form
          className="space-y-3.5 lg:space-y-5"
          onSubmit={handleSubmit(onSubmit)}
        >
          {isRegistered ? (
            <p className="rounded-md bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
              Đăng ký thành công. Vui lòng đăng nhập để tiếp tục.
            </p>
          ) : null}

          {isPasswordReset ? (
            <p className="rounded-md bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
              Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.
            </p>
          ) : null}

          <FormField
            label="Tài khoản"
            icon={Mail}
            type="email"
            autoComplete="email"
            placeholder="Nhập email của bạn"
            error={errors.email?.message}
            {...register('email')}
          />

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600">
                Mật khẩu
              </span>
              <Link
                href="/forgot-password"
                className="text-[11px] font-semibold text-brand-600 transition hover:text-brand-700"
              >
                Quên mật khẩu?
              </Link>
            </div>
            <PasswordField
              label=""
              autoComplete="current-password"
              placeholder="Nhập mật khẩu của bạn"
              error={errors.password?.message}
              {...register('password')}
            />
          </div>

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
            {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>
      </AuthCard>

      <p className="mt-6 text-center text-xs text-slate-500">
        Chưa có tài khoản?{' '}
        <Link
          href="/register"
          className="font-semibold text-brand-600 transition hover:text-brand-700"
        >
          Đăng ký tài khoản
        </Link>
      </p>
    </div>
  );
}
