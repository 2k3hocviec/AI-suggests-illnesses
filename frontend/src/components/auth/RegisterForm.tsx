'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarDays, MapPin, Mail, Phone, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  District,
  listDistricts,
  listProvinces,
  listWards,
  Province,
  Ward,
} from '@/lib/administrative-units-api';
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
    streetAddress: z.string().min(3, 'Vui lòng nhập số nhà và tên đường'),
    provinceCode: z.coerce.number().int().positive('Vui lòng chọn tỉnh/thành'),
    districtCode: z.coerce.number().int().positive('Vui lòng chọn quận/huyện'),
    wardCode: z.coerce.number().int().positive('Vui lòng chọn xã/phường'),
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
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phoneNumber: '',
      dateOfBirth: '',
      gender: 'MALE',
      streetAddress: '',
      provinceCode: 0,
      districtCode: 0,
      wardCode: 0,
      password: '',
      confirmPassword: '',
    },
  });
  const provinceCode = watch('provinceCode');
  const districtCode = watch('districtCode');

  useEffect(() => {
    listProvinces()
      .then(setProvinces)
      .catch(() => setServerError('Không thể tải danh sách tỉnh/thành.'));
  }, []);

  useEffect(() => {
    setDistricts([]);
    setWards([]);
    setValue('districtCode', 0);
    setValue('wardCode', 0);

    if (!provinceCode) {
      return;
    }

    listDistricts(provinceCode)
      .then(setDistricts)
      .catch(() => setServerError('Không thể tải danh sách quận/huyện.'));
  }, [provinceCode, setValue]);

  useEffect(() => {
    setWards([]);
    setValue('wardCode', 0);

    if (!districtCode) {
      return;
    }

    listWards(districtCode)
      .then(setWards)
      .catch(() => setServerError('Không thể tải danh sách xã/phường.'));
  }, [districtCode, setValue]);

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
        streetAddress: values.streetAddress,
        provinceCode: values.provinceCode,
        districtCode: values.districtCode,
        wardCode: values.wardCode,
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

          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-600">
              <MapPin className="h-3.5 w-3.5" />
              Địa chỉ
            </div>
            <div className="mb-3">
              <FormField
                label="Số nhà và tên đường"
                icon={MapPin}
                type="text"
                autoComplete="street-address"
                placeholder="Ví dụ: Số 12 Nguyễn Trãi"
                error={errors.streetAddress?.message}
                {...register('streetAddress')}
              />
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              <label className="block">
                <select
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 lg:h-11 lg:text-sm"
                  {...register('provinceCode', { valueAsNumber: true })}
                >
                  <option value={0}>Tỉnh/thành</option>
                  {provinces.map((province) => (
                    <option key={province.code} value={province.code}>
                      {province.name}
                    </option>
                  ))}
                </select>
                {errors.provinceCode?.message ? (
                  <span className="mt-1 block text-[11px] text-red-500">
                    {errors.provinceCode.message}
                  </span>
                ) : null}
              </label>

              <label className="block">
                <select
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100 lg:h-11 lg:text-sm"
                  disabled={!provinceCode}
                  {...register('districtCode', { valueAsNumber: true })}
                >
                  <option value={0}>Quận/huyện</option>
                  {districts.map((district) => (
                    <option key={district.code} value={district.code}>
                      {district.name}
                    </option>
                  ))}
                </select>
                {errors.districtCode?.message ? (
                  <span className="mt-1 block text-[11px] text-red-500">
                    {errors.districtCode.message}
                  </span>
                ) : null}
              </label>

              <label className="block">
                <select
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100 lg:h-11 lg:text-sm"
                  disabled={!districtCode}
                  {...register('wardCode', { valueAsNumber: true })}
                >
                  <option value={0}>Xã/phường</option>
                  {wards.map((ward) => (
                    <option key={ward.code} value={ward.code}>
                      {ward.name}
                    </option>
                  ))}
                </select>
                {errors.wardCode?.message ? (
                  <span className="mt-1 block text-[11px] text-red-500">
                    {errors.wardCode.message}
                  </span>
                ) : null}
              </label>
            </div>
          </div>

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
