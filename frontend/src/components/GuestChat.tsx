"use client";

import { Bot, LogIn, Stethoscope, UserPlus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ChatMessage, sendGuestChatMessage } from "@/lib/chat-api";
import { ConsultationChat } from "./dashboard/ConsultationChat";

const MAX_GUEST_REQUESTS = 5;

export function GuestChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [requestCount, setRequestCount] = useState(0);

  async function handleSend(content: string) {
    if (requestCount >= MAX_GUEST_REQUESTS) {
      return;
    }

    setError(null);
    setIsSending(true);
    setRequestCount((current) => current + 1);

    const isRepeatedQuestion = messages.some(
      (message) =>
        message.role === "USER" &&
        normalizeRepeatedMessage(message.content) ===
          normalizeRepeatedMessage(content),
    );
    if (isRepeatedQuestion) {
      const previousUserIndex = [...messages]
        .map((message, index) => ({ message, index }))
        .reverse()
        .find(
          ({ message }) =>
            message.role === "USER" &&
            normalizeRepeatedMessage(message.content) ===
              normalizeRepeatedMessage(content),
        )?.index;
      const previousAssistantMessage =
        previousUserIndex === undefined
          ? undefined
          : messages
              .slice(previousUserIndex + 1)
              .find((message) => message.role === "ASSISTANT");
      const createdAt = new Date().toISOString();
      const timestamp = Date.now();
      setMessages((current) => [
        ...current,
        {
          id: -timestamp,
          sessionId: 0,
          userId: null,
          role: "USER",
          content,
          metadata: null,
          createdAt,
        },
        {
          id: -(timestamp + 1),
          sessionId: 0,
          userId: null,
          role: "ASSISTANT",
          content:
            previousAssistantMessage?.content ??
            "Mình đã ghi nhận câu hỏi này ở tin nhắn trước.",
          metadata: previousAssistantMessage?.metadata ?? {
            repeatDetected: true,
          },
          createdAt,
        },
      ]);
      setIsSending(false);
      return;
    }

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
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 sm:px-5 lg:px-10">
        <Link href="/" className="flex min-w-0 items-center gap-2 sm:gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm sm:h-10 sm:w-10">
            <Stethoscope className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-base font-bold leading-none text-[#073b83] sm:text-lg">
              HealthAI
            </span>
            <span className="mt-1 block truncate text-[10px] text-slate-500 sm:text-xs">
              Tư vấn sức khỏe thông minh
            </span>
          </span>
        </Link>

        <nav className="flex shrink-0 items-center gap-1.5 sm:gap-2 lg:gap-3">
          <Link
            href="/login"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#073f87] px-2 text-xs font-semibold text-white transition hover:bg-[#052f66] sm:gap-2 sm:px-3 sm:text-sm"
          >
            <LogIn className="h-4 w-4" />
            <span>Đăng nhập</span>
          </Link>
          <Link
            href="/register"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#073f87] px-2 text-xs font-semibold text-white transition hover:bg-[#052f66] sm:gap-2 sm:px-3 sm:text-sm"
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
              notice={
                requestCount >= MAX_GUEST_REQUESTS
                  ? "Bạn đã sử dụng 5 lượt chat miễn phí. Hãy đăng nhập để tiếp tục hoặc tải lại trang để bắt đầu lại."
                  : `Bạn còn ${MAX_GUEST_REQUESTS - requestCount} lượt chat miễn phí trong lần truy cập này.`
              }
              isSending={isSending}
              disabled={requestCount >= MAX_GUEST_REQUESTS}
              onSend={handleSend}
            />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function normalizeRepeatedMessage(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}
