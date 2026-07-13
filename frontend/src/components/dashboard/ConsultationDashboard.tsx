'use client';

import { useEffect, useState } from 'react';
import {
  ChatMessage,
  ChatSession,
  listChatMessages,
  listChatSessions,
  sendChatMessage,
} from '@/lib/chat-api';
import { ChatHistoryDialog } from './ChatHistoryDialog';
import { ConsultationChat } from './ConsultationChat';
import { ConsultationHeader } from './ConsultationHeader';
import { UserAppShell } from './UserAppShell';
import { UserSidebar } from './UserSidebar';

export function ConsultationDashboard() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  useEffect(() => {
    void refreshSessions();
  }, []);

  async function refreshSessions() {
    setIsLoadingSessions(true);
    try {
      const nextSessions = await listChatSessions();
      setSessions(nextSessions);
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError, 'Không thể tải lịch sử.'));
    } finally {
      setIsLoadingSessions(false);
    }
  }

  function handleNewChat() {
    setActiveSessionId(undefined);
    setMessages([]);
    setError(null);
  }

  async function handleOpenHistory() {
    setIsHistoryOpen(true);
    await refreshSessions();
  }

  async function handleSelectSession(sessionId: number) {
    if (sessionId === activeSessionId) {
      return;
    }

    setError(null);
    setIsLoadingMessages(true);
    try {
      const sessionMessages = await listChatMessages(sessionId);
      setActiveSessionId(sessionId);
      setMessages(sessionMessages);
    } catch (requestError) {
      setError(
        getRequestErrorMessage(requestError, 'Không thể tải phiên chat.'),
      );
    } finally {
      setIsLoadingMessages(false);
    }
  }

  async function handleSend(content: string) {
    setError(null);
    setIsSending(true);
    try {
      const response = await sendChatMessage(content, activeSessionId);
      setActiveSessionId(response.session.id);
      setMessages((current) => [
        ...current,
        response.userMessage,
        response.assistantMessage,
      ]);
      await refreshSessions();
    } catch (requestError) {
      setError(
        getRequestErrorMessage(requestError, 'Không thể gửi tin nhắn.'),
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <UserAppShell
      sidebar={
        <UserSidebar
          onNewChat={handleNewChat}
          onOpenHistory={handleOpenHistory}
        />
      }
    >
      <ConsultationHeader
        onNewChat={handleNewChat}
        onOpenHistory={handleOpenHistory}
      />
      <ConsultationChat
        messages={messages}
        error={error}
        isSending={isSending}
        isLoadingMessages={isLoadingMessages}
        onSend={handleSend}
      />
      <ChatHistoryDialog
        isOpen={isHistoryOpen}
        sessions={sessions}
        activeSessionId={activeSessionId}
        isLoading={isLoadingSessions}
        onClose={() => setIsHistoryOpen(false)}
        onSelectSession={handleSelectSession}
      />
    </UserAppShell>
  );
}

function getRequestErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
