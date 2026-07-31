"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMe } from "@/lib/auth-api";
import {
  ChatMessage,
  ChatSession,
  closeChatSession,
  deleteChatSession,
  listChatMessages,
  listChatSessions,
  sendChatMessage,
} from "@/lib/chat-api";
import { requestDoctorChat } from "@/lib/direct-chat-api";
import { ChatHistoryDialog } from "./ChatHistoryDialog";
import { ConsultationChat } from "./ConsultationChat";
import { ConsultationHeader } from "./ConsultationHeader";
import { UserAppShell } from "./UserAppShell";
import { UserSidebar } from "./UserSidebar";
import { DirectChatNotificationListener } from "../direct-chat/DirectChatNotificationListener";

export function ConsultationDashboard() {
  const router = useRouter();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isClosingSession, setIsClosingSession] = useState(false);

  useEffect(() => {
    async function bootstrap() {
      try {
        const me = await getMe();

        if (me.role === "ADMIN") {
          router.replace("/admin");
          return;
        }
        if (me.role === "DOCTOR") {
          router.replace("/doctor");
          return;
        }

        await refreshSessions();
      } catch {
        localStorage.removeItem("accessToken");
        router.replace("/");
      }
    }

    void bootstrap();
  }, [router]);

  async function refreshSessions() {
    setIsLoadingSessions(true);
    try {
      const nextSessions = await listChatSessions();
      setSessions(nextSessions);
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError, "Không thể tải lịch sử."));
    } finally {
      setIsLoadingSessions(false);
    }
  }

  function handleNewChat() {
    setActiveSessionId(undefined);
    setMessages([]);
    setError(null);
    setNotice(null);
  }

  async function handleCloseSession(sessionId = activeSessionId) {
    if (!sessionId) {
      return;
    }

    setError(null);
    setIsClosingSession(true);
    try {
      const closedSession = await closeChatSession(sessionId);
      setSessions((current) =>
        current.map((session) =>
          session.id === sessionId
            ? { ...session, closedAt: closedSession.closedAt }
            : session,
        ),
      );
      setNotice(
        "Phiên chat đã được đóng. Bạn có thể mở lại nội dung trong lịch sử.",
      );
    } catch (requestError) {
      setError(
        getRequestErrorMessage(requestError, "Không thể đóng phiên chat."),
      );
    } finally {
      setIsClosingSession(false);
    }
  }

  async function handleDeleteSession(sessionId: number) {
    setError(null);
    try {
      await deleteChatSession(sessionId);
      setSessions((current) =>
        current.filter((session) => session.id !== sessionId),
      );
      if (activeSessionId === sessionId) {
        setActiveSessionId(undefined);
        setMessages([]);
      }
      setNotice("Phiên chat đã được ẩn khỏi lịch sử của bạn.");
    } catch (requestError) {
      setError(
        getRequestErrorMessage(requestError, "Không thể ẩn phiên chat."),
      );
    }
  }

  function handleOpenDirectChat() {
    router.push("/direct-chat");
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
        getRequestErrorMessage(requestError, "Không thể tải phiên chat."),
      );
    } finally {
      setIsLoadingMessages(false);
    }
  }

  async function handleSend(content: string) {
    const activeSession = sessions.find(
      (session) => session.id === activeSessionId,
    );
    if (activeSession?.closedAt) {
      setError("Phiên chat đã đóng. Hãy bắt đầu một đoạn chat mới.");
      return;
    }

    setError(null);
    setNotice(null);
    setIsSending(true);
    const optimisticMessageId = -Date.now();
    const optimisticMessage: ChatMessage = {
      id: optimisticMessageId,
      sessionId: activeSessionId ?? 0,
      userId: null,
      role: "USER",
      content,
      metadata: null,
      createdAt: new Date().toISOString(),
    };

    setMessages((current) => [...current, optimisticMessage]);
    try {
      const response = await sendChatMessage(content, activeSessionId);
      setActiveSessionId(response.session.id);
      setMessages((current) => [
        ...current.filter((message) => message.id !== optimisticMessageId),
        response.userMessage,
        response.assistantMessage,
      ]);
      await refreshSessions();
    } catch (requestError) {
      setMessages((current) =>
        current.filter((message) => message.id !== optimisticMessageId),
      );
      setError(getRequestErrorMessage(requestError, "Không thể gửi tin nhắn."));
    } finally {
      setIsSending(false);
    }
  }

  async function handleRequestDoctorChat(
    doctorId: number,
    consultationSummary?: string,
  ) {
    setError(null);
    const result = await requestDoctorChat(doctorId, consultationSummary);
    setNotice(
      result.created
        ? "Đã gửi yêu cầu chat trực tiếp. Bạn có thể theo dõi trong mục “Chat với bác sĩ”."
        : "Yêu cầu này đã tồn tại. Bạn có thể mở mục “Chat với bác sĩ” để theo dõi.",
    );
    return {
      created: result.created,
    };
  }

  return (
    <UserAppShell
      sidebar={
        <UserSidebar
          onNewChat={handleNewChat}
          onOpenHistory={handleOpenHistory}
          onOpenDirectChat={handleOpenDirectChat}
        />
      }
    >
      <ConsultationHeader
        onNewChat={handleNewChat}
        onOpenHistory={handleOpenHistory}
        onOpenDirectChat={handleOpenDirectChat}
        activeSession={sessions.find(
          (session) => session.id === activeSessionId,
        )}
        onCloseSession={() => void handleCloseSession()}
        isClosingSession={isClosingSession}
      />
      <DirectChatNotificationListener />
      <ConsultationChat
        messages={messages}
        error={error}
        notice={notice}
        isSending={isSending}
        isLoadingMessages={isLoadingMessages}
        isClosed={Boolean(
          sessions.find((session) => session.id === activeSessionId)?.closedAt,
        )}
        onSend={handleSend}
        onRequestDoctorChat={handleRequestDoctorChat}
      />
      <ChatHistoryDialog
        isOpen={isHistoryOpen}
        sessions={sessions}
        activeSessionId={activeSessionId}
        isLoading={isLoadingSessions}
        onClose={() => setIsHistoryOpen(false)}
        onSelectSession={handleSelectSession}
        onCloseSession={handleCloseSession}
        onDeleteSession={handleDeleteSession}
      />
    </UserAppShell>
  );
}

function getRequestErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
