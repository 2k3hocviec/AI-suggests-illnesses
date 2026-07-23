import { UserSidebar } from './UserSidebar';

interface UserAppShellProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
}

export function UserAppShell({ children, sidebar }: UserAppShellProps) {
  return (
    <main className="h-screen w-full max-w-full overflow-hidden bg-[#fbfaf9] text-ink">
      <div className="grid h-full min-h-0 lg:grid-cols-[280px_minmax(0,1fr)]">
        {sidebar ?? <UserSidebar />}
        <section className="flex min-h-0 min-w-0 w-full max-w-full flex-col border-l border-slate-200 bg-[#fbfaf9]">
          {children}
        </section>
      </div>
    </main>
  );
}
