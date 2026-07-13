"use client";

import { History, Menu, MessageSquareText } from "lucide-react";
import { useState } from "react";

export function MobileNavigationMenu() {
  const [isOpen, setIsOpen] = useState(false);

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
        <div className="absolute left-0 top-11 z-30 w-44 rounded-lg border border-slate-200 bg-white py-2 shadow-lg">
          <a
            href="/dashboard"
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <MessageSquareText className="h-4 w-4" />
            Đoạn chat mới
          </a>
          <a
            href="/dashboard"
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <History className="h-4 w-4" />
            Lịch sử chat
          </a>
        </div>
      ) : null}
    </div>
  );
}
