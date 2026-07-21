"use client";

import { Bot, LogIn, Stethoscope, UserPlus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ChatMessage, sendGuestChatMessage } from "@/lib/chat-api";
import { ConsultationChat } from "./dashboard/ConsultationChat";

export function GuestChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  async function handleSend(content: string) {
    setError(null);
    setIsSending(true);

    const optimisticMessageId = -Date.now();
    const optimisticMessage: ChatMessage = {
      id: optimisticMessageId,
      sessionId: 0,
      userId: null,
      role: "USER",
      content,
      metadata: null,
      createdAt: new Date().toISOString(),
    };

    setMessages((current) => [...current, optimisticMessage]);

    try {
      const response = await sendGuestChatMessage(content);
      setMessages((current) => [
        ...current.filter((message) => message.id !== optimisticMessageId),
        response.userMessage,
        response.assistantMessage,
      ]);
    } catch (requestError) {
      setMessages((current) =>
        current.filter((message) => message.id !== optimisticMessageId),
      );
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Không thể gửi tin nhắn.",
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[#f1f5f9] text-ink">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 lg:px-10">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm">
            <Stethoscope className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-lg font-bold leading-none text-[#073b83]">
              HealthAI
            </span>
            <span className="mt-1 block text-xs text-slate-500">
              Tư vấn sức khỏe thông minh
            </span>
          </span>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            <LogIn className="h-4 w-4" />
            <span className="hidden sm:inline">Đăng nhập</span>
          </Link>
          <Link
            href="/register"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#073f87] px-3 text-sm font-semibold text-white transition hover:bg-[#052f66]"
          >
            <UserPlus className="h-4 w-4" />
            <span>Đăng ký</span>
          </Link>
        </nav>
      </header>

      <section className="flex min-h-0 flex-1 flex-col px-3 py-3 sm:px-5 lg:px-8">
        <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.12)] ring-1 ring-white/80">
            <div className="hidden">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-700 text-white">
                  <Bot className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    Trò chuyện với HealthAI
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Đang hoạt động
              </span>
            </div>

            <div className="flex min-h-0 flex-1 flex-col bg-[#fcfdfd]">
              <ConsultationChat
                messages={messages}
                error={error}
                isSending={isSending}
                onSend={handleSend}
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
