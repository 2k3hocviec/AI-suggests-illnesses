'use client';

import { Bot, UserCircle } from 'lucide-react';
import { useEffect, useRef } from 'react';

export interface ThreadMessage {
  id: number | string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  createdAt: string;
}

interface ConsultationThreadProps {
  messages: ThreadMessage[];
  isThinking?: boolean;
  isLoadingMessages?: boolean;
}

export function ConsultationThread({
  messages,
  isThinking = false,
  isLoadingMessages = false,
}: ConsultationThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    });
  }, [messages, isThinking]);

  return (
    <section className="min-h-0 flex-1 overflow-y-auto px-4 py-5 lg:px-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        {isLoadingMessages ? (
          <div className="rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm text-slate-600 shadow-sm">
            Đang tải phiên chat...
          </div>
        ) : null}

        {messages.map((message) => {
          const time = formatTime(message.createdAt);

          if (message.role === 'USER') {
            return (
              <div key={message.id} className="flex justify-end gap-5">
                <div className="max-w-[76%]">
                  <div className="rounded-bl-xl rounded-tl-xl rounded-tr-xl bg-[#073f87] px-4 py-3.5 text-sm leading-6 text-white shadow-sm lg:text-[15px]">
                    {message.content}
                  </div>
                  <p className="mt-2 text-right text-xs text-slate-600">
                    {time}
                  </p>
                </div>
                <div className="mt-1 hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#073b83] shadow-sm ring-1 ring-slate-200 sm:flex">
                  <UserCircle className="h-6 w-6" />
                </div>
              </div>
            );
          }

          return (
            <div key={message.id} className="flex items-start gap-5">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white shadow-sm">
                <Bot className="h-4 w-4" />
              </div>
              <div className="max-w-[76%]">
                <div className="whitespace-pre-line rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm leading-6 shadow-sm lg:text-[15px]">
                  <p>{message.content}</p>
                </div>
                <p className="mt-2 text-xs text-slate-600">{time}</p>
              </div>
            </div>
          );
        })}

        {isThinking ? (
          <div className="flex items-start gap-5">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white shadow-sm">
              <Bot className="h-4 w-4" />
            </div>
            <div className="rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm text-slate-600 shadow-sm">
              Đang phân tích triệu chứng...
            </div>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>
    </section>
  );
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
