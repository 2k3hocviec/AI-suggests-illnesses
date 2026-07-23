import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { AuthHeroPanel } from './AuthHeroPanel';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main className="grid min-h-screen bg-[#f7f8fb] lg:grid-cols-2">
      <AuthHeroPanel />
      <section className="grid min-h-screen place-items-center px-6 py-10 sm:px-10">
        <div className="w-full max-w-[340px] lg:max-w-[430px]">
          <Link
            href="/"
            className="mb-3 inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-brand-200 hover:text-brand-700 lg:mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Về trang chủ
          </Link>
          {children}
        </div>
      </section>
    </main>
  );
}
