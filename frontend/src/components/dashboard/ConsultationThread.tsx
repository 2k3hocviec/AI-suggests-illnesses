'use client';

import { Bot, Mail, Phone, UserCircle } from 'lucide-react';
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
  const threadRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const thread = threadRef.current;
    if (!thread) {
      return;
    }

    thread.scrollTo({
      top: thread.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, isThinking]);

  return (
    <section
      ref={threadRef}
      className="chat-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 lg:px-10"
    >
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
                  <AssistantContent content={message.content} />
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
      </div>
    </section>
  );
}

function AssistantContent({ content }: { content: string }) {
  return (
    <div className="space-y-1">
      {content.split('\n').map((line, index) => {
        const phone = getContactValue(line, 'Điện thoại:');
        const email = getContactValue(line, 'Email:');
        const trimmedLine = line.trim();

        if (phone && phone !== 'chưa cập nhật') {
          return (
            <div key={`${line}-${index}`} className="pt-1">
              <a
                href={`tel:${phone.replace(/\s+/g, '')}`}
                className="inline-flex items-center gap-2 rounded-md bg-[#073f87] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#052f66]"
              >
                <Phone className="h-3.5 w-3.5" />
                Gọi điện
              </a>
              <span className="ml-2 text-slate-600">{phone}</span>
            </div>
          );
        }

        if (email && email !== 'chưa cập nhật') {
          return (
            <div key={`${line}-${index}`} className="pt-1">
              <a
                href={`mailto:${email}`}
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <Mail className="h-3.5 w-3.5" />
                Gửi email
              </a>
              <span className="ml-2 text-slate-600">{email}</span>
            </div>
          );
        }

        if (!trimmedLine) {
          return <div key={`${line}-${index}`} className="h-2" />;
        }

        if (trimmedLine === 'Kết quả tham khảo') {
          return (
            <h3
              key={`${line}-${index}`}
              className="text-base font-bold text-slate-950 lg:text-lg"
            >
              {trimmedLine}
            </h3>
          );
        }

        if (/^\d+\.\s/.test(trimmedLine)) {
          return (
            <h4
              key={`${line}-${index}`}
              className="pt-3 text-[15px] font-bold text-[#073b83] lg:text-base"
            >
              {trimmedLine}
            </h4>
          );
        }

        if (trimmedLine.startsWith('Điểm phù hợp:')) {
          return (
            <p
              key={`${line}-${index}`}
              className="font-bold text-emerald-700"
            >
              {trimmedLine}
            </p>
          );
        }

        if (trimmedLine.startsWith('Lý do đề xuất:')) {
          return (
            <p
              key={`${line}-${index}`}
              className="mt-1 rounded-md bg-emerald-50 px-3 py-2 font-medium text-emerald-800"
            >
              <span className="font-bold">Lý do đề xuất:</span>
              {` ${trimmedLine.replace('Lý do đề xuất:', '').trim()}`}
            </p>
          );
        }

        if (trimmedLine.startsWith('Nguồn phân tích:')) {
          const source = trimmedLine.replace('Nguồn phân tích:', '').trim();
          const isGemini = source.toLowerCase() === 'gemini';

          return (
            <p
              key={`${line}-${index}`}
              className="mt-2 inline-flex w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600"
            >
              {isGemini ? 'Nguồn phân tích: Gemini' : 'Nguồn phân tích: NER'}
            </p>
          );
        }

        if (trimmedLine.startsWith('•')) {
          const [label, ...rest] = trimmedLine.slice(1).split(':');
          const value = rest.join(':').trim();

          return (
            <p key={`${line}-${index}`} className="pl-3 text-slate-700">
              <span className="font-semibold text-slate-900">
                • {label.trim()}:
              </span>{' '}
              {value}
            </p>
          );
        }

        return (
          <p key={`${line}-${index}`} className="text-slate-700">
            {trimmedLine}
          </p>
        );
      })}
    </div>
  );
}

function getContactValue(line: string, label: string) {
  const normalizedLine = line.replace(/^•\s*/, '').trim();

  if (!normalizedLine.startsWith(label)) {
    return null;
  }

  return normalizedLine.slice(label.length).trim();
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
