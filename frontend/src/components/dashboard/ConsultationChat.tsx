'use client';

import { useMemo, useState } from 'react';
import { ChatMessage, sendChatMessage } from '@/lib/chat-api';
import { ChatComposer } from './ChatComposer';
import { ConsultationThread, ThreadMessage } from './ConsultationThread';

const welcomeMessage: ThreadMessage = {
  id: 'welcome',
  role: 'ASSISTANT',
  content:
    'Xin chào, tôi là HealthAI Assistant. Bạn hãy mô tả các triệu chứng đang gặp phải để tôi hỗ trợ gợi ý chuyên khoa phù hợp.',
  createdAt: new Date().toISOString(),
};

export function ConsultationChat() {
  const [sessionId, setSessionId] = useState<number>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const threadMessages = useMemo<ThreadMessage[]>(
    () => [
      welcomeMessage,
      ...messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
      })),
    ],
    [messages],
  );

  async function handleSend(content: string) {
    setError(null);
    setIsSending(true);
    try {
      const response = await sendChatMessage(content, sessionId);
      setSessionId(response.session.id);
      setMessages((current) => [
        ...current,
        response.userMessage,
        response.assistantMessage,
      ]);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Không thể gửi tin nhắn. Vui lòng thử lại.',
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <>
      <ConsultationThread messages={threadMessages} isThinking={isSending} />
      {error ? (
        <p className="mx-auto w-full max-w-5xl px-4 pb-2 text-sm text-red-600 lg:px-10">
          {error}
        </p>
      ) : null}
      <ChatComposer onSend={handleSend} disabled={isSending} />
    </>
  );
}
