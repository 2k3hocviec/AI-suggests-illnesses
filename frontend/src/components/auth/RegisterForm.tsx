'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarDays, MapPin, Mail, Phone, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { register as registerAccount } from '@/lib/auth-api';
import { AuthCard } from './AuthCard';
import { FormField } from './FormField';
import { PasswordField } from './PasswordField';

const registerSchema = z
  .object({
    fullName: z.string().min(2, 'Vui lòng nhập họ tên'),
    email: z.string().email('Email không hợp lệ'),
    phoneNumber: z.string().min(8, 'Số điện thoại không hợp lệ'),
    dateOfBirth: z.string().min(1, 'Vui lòng chọn ngày sinh'),
    gender: z.enum(['MALE', 'FEMALE'], {
      required_error: 'Vui lòng chọn giới tính',
    }),
    address: z.string().min(5, 'Vui lòng nhập địa chỉ'),
    password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
    confirmPassword: z.string().min(6, 'Vui lòng xác nhận mật khẩu'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phoneNumber: '',
      dateOfBirth: '',
      gender: 'MALE',
      address: '',
      password: '',
      confirmPassword: '',
    },
  });

  async function onSubmit(values: RegisterFormValues) {
    setServerError(null);
    setIsSubmitting(true);
    try {
      await registerAccount({
        fullName: values.fullName,
        email: values.email,
        phoneNumber: values.phoneNumber,
        dateOfBirth: values.dateOfBirth,
        gender: values.gender,
        address: values.address,
        password: values.password,
      });
      router.push('/login?registered=1');
    } catch (error) {
      setServerError(
        error instanceof Error
          ? error.message
          : 'Không thể đăng ký. Vui lòng thử lại.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="w-full">
      <AuthCard>
        <div className="mb-4 lg:mb-5">
          <h2 className="text-base font-bold text-ink lg:text-xl">
            Đăng ký tài khoản
          </h2>
          <p className="mt-1 text-xs text-slate-500 lg:text-sm">
            Tạo tài khoản để bắt đầu tư vấn triệu chứng
          </p>
        </div>

        <form
          className="space-y-3 lg:space-y-3.5"
          onSubmit={handleSubmit(onSubmit)}
        >
          <div className="grid gap-3 lg:grid-cols-2">
            <FormField
              label="Họ và tên"
              icon={UserRound}
              type="text"
              autoComplete="name"
              placeholder="Nhập họ tên"
              error={errors.fullName?.message}
              {...register('fullName')}
            />

            <FormField
              label="Email"
              icon={Mail}
              type="email"
              autoComplete="email"
              placeholder="Nhập email"
              error={errors.email?.message}
              {...register('email')}
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <FormField
              label="Số điện thoại"
              icon={Phone}
              type="tel"
              autoComplete="tel"
              placeholder="Số điện thoại"
              error={errors.phoneNumber?.message}
              {...register('phoneNumber')}
            />

            <FormField
              label="Ngày sinh"
              icon={CalendarDays}
              type="date"
              autoComplete="bday"
              error={errors.dateOfBirth?.message}
              {...register('dateOfBirth')}
            />

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">
                Giới tính
              </span>
              <select
                className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 lg:h-11 lg:text-sm"
                {...register('gender')}
              >
                <option value="MALE">Nam</option>
                <option value="FEMALE">Nữ</option>
              </select>
              {errors.gender?.message ? (
                <span className="mt-1 block text-[11px] text-red-500">
                  {errors.gender.message}
                </span>
              ) : null}
            </label>
          </div>

          <FormField
            label="Địa chỉ"
            icon={MapPin}
            type="text"
            autoComplete="street-address"
            placeholder="Nhập địa chỉ của bạn"
            error={errors.address?.message}
            {...register('address')}
          />

          <div className="grid gap-3 lg:grid-cols-2">
            <PasswordField
              label="Mật khẩu"
              autoComplete="new-password"
              placeholder="Tạo mật khẩu"
              error={errors.password?.message}
              {...register('password')}
            />

            <PasswordField
              label="Xác nhận mật khẩu"
              autoComplete="new-password"
              placeholder="Nhập lại mật khẩu"
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
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
            {isSubmitting ? 'Đang tạo tài khoản...' : 'Đăng ký'}
          </button>
        </form>
      </AuthCard>

      <p className="mt-6 text-center text-xs text-slate-500">
        Đã có tài khoản?{' '}
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
