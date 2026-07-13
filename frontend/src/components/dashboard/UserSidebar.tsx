import { History, MessageSquareText, Stethoscope } from "lucide-react";

export function UserSidebar() {
  return (
    <aside className="hidden h-screen flex-col bg-[#f7f6f5] px-5 py-5 shadow-[4px_0_18px_rgba(15,23,42,0.05)] lg:flex">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm">
          <Stethoscope className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold leading-none text-[#073b83]">
            HealthAI
          </h1>
          <p className="mt-1 text-xs text-slate-500">Y tế thông minh</p>
        </div>
      </div>

      <nav className="mt-10 space-y-2.5">
        <a
          href="/dashboard"
          className="flex h-12 items-center gap-3 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white shadow-sm"
        >
          <MessageSquareText className="h-5 w-5" />
          Đoạn chat mới
        </a>
        <a
          href="/dashboard"
          className="flex h-11 items-center gap-3 rounded-lg px-4 text-sm font-medium text-slate-700 transition hover:bg-white"
        >
          <History className="h-5 w-5" />
          Lịch sử chat
        </a>
      </nav>
    </aside>
  );
}
