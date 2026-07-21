'use client';

import { useMemo } from 'react';
import { ChatMessage } from '@/lib/chat-api';
import { ChatComposer } from './ChatComposer';
import { ConsultationThread, ThreadMessage } from './ConsultationThread';

const welcomeMessage: ThreadMessage = {
  id: 'welcome',
  role: 'ASSISTANT',
  content:
    'Xin chào, tôi là HealthAI Assistant. Bạn hãy mô tả các triệu chứng đang gặp phải để tôi hỗ trợ gợi ý chuyên khoa phù hợp.',
  createdAt: new Date().toISOString(),
};

interface ConsultationChatProps {
  messages: ChatMessage[];
  error?: string | null;
  notice?: string | null;
  isSending?: boolean;
  isLoadingMessages?: boolean;
  disabled?: boolean;
  onSend: (message: string) => Promise<void> | void;
}

export function ConsultationChat({
  messages,
  error,
  notice,
  isSending = false,
  isLoadingMessages = false,
  disabled = false,
  onSend,
}: ConsultationChatProps) {
  const threadMessages = useMemo<ThreadMessage[]>(
    () => [
      ...(messages.length === 0 ? [welcomeMessage] : []),
      ...messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
      })),
    ],
    [messages],
  );

  return (
    <>
      <ConsultationThread
        messages={threadMessages}
        isThinking={isSending}
        isLoadingMessages={isLoadingMessages}
      />
      {error ? (
        <p className="mx-auto w-full max-w-5xl px-4 pb-2 text-sm text-red-600 lg:px-10">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="mx-auto w-full max-w-5xl px-4 pb-2 text-center text-sm font-medium text-slate-600 lg:px-10">
          {notice}
        </p>
      ) : null}
      <ChatComposer
        onSend={onSend}
        disabled={disabled || isSending || isLoadingMessages}
      />
    </>
  );
}
