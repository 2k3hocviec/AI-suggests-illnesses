import { UserMenu } from "./UserMenu";
import { MobileNavigationMenu } from "./MobileNavigationMenu";

interface ConsultationHeaderProps {
  onNewChat?: () => void;
  onOpenHistory?: () => void;
}

export function ConsultationHeader({
  onNewChat,
  onOpenHistory,
}: ConsultationHeaderProps) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-[#fbfaf9] px-5 lg:px-10">
      <div className="flex min-w-0 items-center gap-3">
        <MobileNavigationMenu
          onNewChat={onNewChat}
          onOpenHistory={onOpenHistory}
        />
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-lg font-bold text-[#073b83] sm:text-xl lg:text-2xl">
            Tư vấn đang có hiệu lực
          </h2>
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
        </div>
      </div>

      <UserMenu />
    </header>
  );
}
