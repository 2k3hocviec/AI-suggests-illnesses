'use client';

import { clsx } from 'clsx';
import { Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { forwardRef, useState } from 'react';

interface PasswordFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
}

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  ({ label, error, className, ...props }, ref) => {
    const [isVisible, setIsVisible] = useState(false);

    return (
      <label className="block">
        {label ? (
          <span className="mb-1.5 block text-xs font-medium text-slate-600">
            {label}
          </span>
        ) : null}
        <span
          className={clsx(
            'flex h-9 items-center rounded-md border bg-white px-2.5 transition focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100 lg:h-11 lg:px-3',
            error ? 'border-red-300' : 'border-slate-200',
          )}
        >
          <LockKeyhole className="mr-2 h-3.5 w-3.5 shrink-0 text-slate-400" />
          <input
            ref={ref}
            type={isVisible ? 'text' : 'password'}
            className={clsx(
              'h-full min-w-0 flex-1 border-0 bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-400 lg:text-sm',
              className,
            )}
            {...props}
          />
          <button
            type="button"
            aria-label={isVisible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            title={isVisible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            onClick={() => setIsVisible((value) => !value)}
            className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
          >
            {isVisible ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
          </button>
        </span>
        {error ? (
          <span className="mt-1 block text-[11px] text-red-500">{error}</span>
        ) : null}
      </label>
    );
  },
);

PasswordField.displayName = 'PasswordField';
