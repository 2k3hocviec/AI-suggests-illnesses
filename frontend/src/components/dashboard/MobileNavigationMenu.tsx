"use client";

import { History, Menu, MessageSquareText } from "lucide-react";
import { useState } from "react";

interface MobileNavigationMenuProps {
  onNewChat?: () => void;
  onOpenHistory?: () => void;
}

export function MobileNavigationMenu({
  onNewChat,
  onOpenHistory,
}: MobileNavigationMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  function handleNewChat() {
    onNewChat?.();
    setIsOpen(false);
  }

  function handleOpenHistory() {
    onOpenHistory?.();
    setIsOpen(false);
  }

  return (
    <div className="relative lg:hidden">
      <button
        type="button"
        aria-label="Mở menu"
        title="Menu"
        onClick={() => setIsOpen((value) => !value)}
        className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[#073b83] shadow-sm ring-1 ring-slate-200"
      >
        <Menu className="h-5 w-5" />
      </button>

      {isOpen ? (
        <div className="absolute left-0 top-11 z-30 w-56 rounded-lg border border-slate-200 bg-white py-2 shadow-lg">
          <button
            type="button"
            onClick={handleNewChat}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            <MessageSquareText className="h-4 w-4" />
            Đoạn chat mới
          </button>
          <button
            type="button"
            onClick={handleOpenHistory}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            <History className="h-4 w-4" />
            Lịch sử chat
          </button>
        </div>
      ) : null}
    </div>
  );
}
