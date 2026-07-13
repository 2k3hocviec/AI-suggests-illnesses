import { UserSidebar } from './UserSidebar';

interface UserAppShellProps {
  children: React.ReactNode;
}

export function UserAppShell({ children }: UserAppShellProps) {
  return (
    <main className="h-screen overflow-hidden bg-[#fbfaf9] text-ink">
      <div className="grid h-full min-h-0 lg:grid-cols-[280px_minmax(0,1fr)]">
        <UserSidebar />
        <section className="flex min-h-0 flex-col border-l border-slate-200 bg-[#fbfaf9]">
          {children}
        </section>
      </div>
    </main>
  );
}
