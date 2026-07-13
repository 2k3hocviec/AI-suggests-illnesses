import { UserMenu } from './UserMenu';
import { MobileNavigationMenu } from './MobileNavigationMenu';

export function ConsultationHeader() {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-[#fbfaf9] px-5 lg:px-10">
      <div className="flex min-w-0 items-center gap-3">
        <MobileNavigationMenu />
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-lg font-bold text-[#073b83] sm:text-xl lg:text-2xl">
            Active Consultation
          </h2>
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
        </div>
      </div>

      <UserMenu />
    </header>
  );
}
