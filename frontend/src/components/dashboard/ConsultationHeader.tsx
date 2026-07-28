import { Archive } from 'lucide-react';
import { ChatSession } from '@/lib/chat-api';
import { UserMenu } from './UserMenu';
import { MobileNavigationMenu } from './MobileNavigationMenu';

interface ConsultationHeaderProps {
  onNewChat?: () => void;
  onOpenHistory?: () => void;
  onOpenDirectChat?: () => void;
  activeSession?: ChatSession;
  onCloseSession?: () => void;
  isClosingSession?: boolean;
}

export function ConsultationHeader({
  onNewChat,
  onOpenHistory,
  onOpenDirectChat,
  activeSession,
  onCloseSession,
  isClosingSession = false,
}: ConsultationHeaderProps) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-[#fbfaf9] px-5 lg:px-10">
      <div className="flex min-w-0 items-center gap-3">
        <MobileNavigationMenu
          onNewChat={onNewChat}
          onOpenHistory={onOpenHistory}
          onOpenDirectChat={onOpenDirectChat}
        />
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-lg font-bold text-[#073b83] sm:text-xl lg:text-2xl">
            Tư vấn đang có hiệu lực
          </h2>
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
        </div>
      </div>

      <div className="flex items-center gap-2">
        {activeSession && !activeSession.closedAt ? (
          <button
            type="button"
            onClick={onCloseSession}
            disabled={isClosingSession}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-200 px-3 text-xs font-semibold text-amber-700 transition hover:bg-amber-50 disabled:opacity-50 sm:text-sm"
            title="Đóng phiên chat hiện tại"
          >
            <Archive className="h-4 w-4" />
            <span className="hidden sm:inline">
              {isClosingSession ? 'Đang đóng...' : 'Đóng chat'}
            </span>
          </button>
        ) : null}
        <UserMenu />
      </div>
    </header>
  );
}
