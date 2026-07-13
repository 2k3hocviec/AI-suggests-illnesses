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
          {children}
        </div>
      </section>
    </main>
  );
}
