import { clsx } from 'clsx';
import { LucideIcon } from 'lucide-react';
import { forwardRef } from 'react';

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  icon: LucideIcon;
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, error, icon: Icon, className, ...props }, ref) => {
    return (
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-600">
          {label}
        </span>
        <span
          className={clsx(
            'flex h-9 items-center rounded-md border bg-white px-2.5 transition focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100 lg:h-11 lg:px-3',
            error ? 'border-red-300' : 'border-slate-200',
          )}
        >
          <Icon className="mr-2 h-3.5 w-3.5 shrink-0 text-slate-400" />
          <input
            ref={ref}
            className={clsx(
              'h-full min-w-0 flex-1 border-0 bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-400 lg:text-sm',
              className,
            )}
            {...props}
          />
        </span>
        {error ? (
          <span className="mt-1 block text-[11px] text-red-500">{error}</span>
        ) : null}
      </label>
    );
  },
);

FormField.displayName = 'FormField';
