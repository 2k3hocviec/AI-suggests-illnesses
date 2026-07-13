'use client';

import { Send } from 'lucide-react';

export function ChatComposer() {
  return (
    <footer className="shrink-0 bg-[#fbfaf9] px-4 pb-4 lg:px-10">
      <div className="mx-auto max-w-5xl">
        <form className="flex h-12 items-center gap-3 rounded-xl border border-slate-300 bg-white px-4 shadow-[0_14px_36px_rgba(15,23,42,0.10)] lg:h-[52px]">
          <input
            type="text"
            className="min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            placeholder="Mô tả triệu chứng của bạn..."
          />
          <button
            type="submit"
            aria-label="Gửi tin nhắn"
            title="Gửi tin nhắn"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#073f87] text-white shadow-sm transition hover:bg-[#052f66]"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
        <p className="mt-2 text-center text-[11px] text-slate-500">
          HealthAI cung cấp thông tin tham khảo. Luôn tham khảo ý kiến bác sĩ để
          được chẩn đoán y khoa.
        </p>
      </div>
    </footer>
  );
}
