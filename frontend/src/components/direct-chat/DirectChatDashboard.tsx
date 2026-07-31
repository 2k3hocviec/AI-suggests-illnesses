"use client";

import {
  ArrowLeft,
  Archive,
  Check,
  Circle,
  ClipboardList,
  Clock3,
  LogOut,
  MessageCircle,
  RefreshCcw,
  Send,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Socket } from "socket.io-client";
import { getMe, logout, AuthUser } from "@/lib/auth-api";
import {
  acceptDirectChatRequest,
  closeDirectChatConversation,
  createDirectChatSocket,
  DirectChatConversation,
  DirectChatMessage,
  DirectChatNotification,
  DirectChatSocketAck,
  deleteDirectChatConversation,
  listDirectChatConversations,
  listDirectChatMessages,
  rejectDirectChatRequest,
} from "@/lib/direct-chat-api";
import { DoctorProfile } from "@/lib/doctors-api";
import { DoctorProfileDialog } from "@/components/doctor/DoctorProfileDialog";

export function DirectChatDashboard() {
  const router = useRouter();
  const [me, setMe] = useState<AuthUser | null>(null);
  const [conversations, setConversations] = useState<DirectChatConversation[]>(
    [],
  );
  const [activeConversationId, setActiveConversationId] = useState<
    number | null
  >(null);
  const [messages, setMessages] = useState<DirectChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [notification, setNotification] =
    useState<DirectChatNotification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isDoctorProfileOpen, setIsDoctorProfileOpen] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState<number | null>(
    null,
  );
  const socketRef = useRef<Socket | null>(null);
  const activeConversationIdRef = useRef<number | null>(null);
  const meRef = useRef<AuthUser | null>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    const data = await listDirectChatConversations();
    setConversations(data);
    return data;
  }, []);

  useEffect(() => {
    async function bootstrap() {
      try {
        const user = await getMe();
        if (user.role === "ADMIN") {
          router.replace("/admin");
          return;
        }

        if (user.role !== "USER" && user.role !== "DOCTOR") {
          router.replace("/chat");
          return;
        }

        meRef.current = user;
        setMe(user);
        await loadConversations();
      } catch {
        localStorage.removeItem("accessToken");
        router.replace("/login");
      } finally {
        setIsLoading(false);
      }
    }

    void bootstrap();
  }, [loadConversations, router]);

  useEffect(() => {
    if (!me) {
      return;
    }

    const socket = createDirectChatSocket();
    socketRef.current = socket;

    const handleConnect = () => {
      setIsConnected(true);
      setError(null);
      const activeId = activeConversationIdRef.current;
      if (activeId) {
        socket.emit("conversation:join", {
          conversationId: activeId,
        });
      }
    };
    const handleDisconnect = () => setIsConnected(false);
    const handleSocketError = (payload: { message?: string }) => {
      setError(payload.message ?? "Kết nối realtime không thành công.");
    };
    const handleRefresh = () => {
      void loadConversations().catch(() => null);
    };
    const handleMessage = (message: DirectChatMessage) => {
      if (activeConversationIdRef.current === message.conversationId) {
        setMessages((current) => mergeMessage(current, message));

        if (message.senderId !== meRef.current?.id) {
          socket.emit("message:read", {
            conversationId: message.conversationId,
          });
        }
      }
      void loadConversations().catch(() => null);
    };
    const handleRead = (payload: {
      readerId: number;
      readAt: string;
      conversationId: number;
    }) => {
      if (activeConversationIdRef.current !== payload.conversationId) {
        return;
      }

      setMessages((current) =>
        current.map((message) =>
          message.senderId !== payload.readerId && !message.readAt
            ? { ...message, readAt: payload.readAt }
            : message,
        ),
      );
    };
    const handleNotification = (payload: DirectChatNotification) => {
      setNotification(payload);
      void loadConversations().catch(() => null);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("socket:error", handleSocketError);
    socket.on("request:new", handleRefresh);
    socket.on("request:updated", handleRefresh);
    socket.on("conversation:closed", handleRefresh);
    socket.on("message:new", handleMessage);
    socket.on("message:read", handleRead);
    socket.on("notification:new", handleNotification);

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [loadConversations, me]);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages]);

  useEffect(() => {
    if (!notification) {
      return;
    }

    const timeout = window.setTimeout(() => setNotification(null), 6000);
    return () => window.clearTimeout(timeout);
  }, [notification]);

  const activeConversation = useMemo(
    () =>
      conversations.find(
        (conversation) => conversation.id === activeConversationId,
      ) ?? null,
    [activeConversationId, conversations],
  );

  const pendingConversations = conversations.filter(
    (conversation) => conversation.status === "PENDING",
  );
  const otherConversations = conversations.filter(
    (conversation) => conversation.status !== "PENDING",
  );

  async function handleOpenConversation(conversation: DirectChatConversation) {
    if (conversation.status !== "ACTIVE" && conversation.status !== "CLOSED") {
      return;
    }

    setError(null);
    setIsLoadingMessages(true);
    const previousId = activeConversationIdRef.current;
    if (previousId && previousId !== conversation.id) {
      socketRef.current?.emit("conversation:leave", {
        conversationId: previousId,
      });
    }

    try {
      const nextMessages = await listDirectChatMessages(conversation.id);
      activeConversationIdRef.current = conversation.id;
      setActiveConversationId(conversation.id);
      setMessages(nextMessages);
      setConversations((current) =>
        current.map((item) =>
          item.id === conversation.id ? { ...item, unreadCount: 0 } : item,
        ),
      );
      socketRef.current?.emit(
        "conversation:join",
        { conversationId: conversation.id },
        (response: DirectChatSocketAck) => {
          if (!response.ok) {
            setError(response.error ?? "Không thể vào phòng chat.");
          }
        },
      );
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Không thể tải tin nhắn."));
    } finally {
      setIsLoadingMessages(false);
    }
  }

  async function handleAccept(conversation: DirectChatConversation) {
    setProcessingRequestId(conversation.id);
    setError(null);
    try {
      const accepted = await acceptDirectChatRequest(conversation.id);
      await loadConversations();
      await handleOpenConversation(accepted);
    } catch (requestError) {
      setError(
        getErrorMessage(requestError, "Không thể chấp nhận yêu cầu chat."),
      );
    } finally {
      setProcessingRequestId(null);
    }
  }

  async function handleReject(conversation: DirectChatConversation) {
    setProcessingRequestId(conversation.id);
    setError(null);
    try {
      await rejectDirectChatRequest(conversation.id);
      await loadConversations();
    } catch (requestError) {
      setError(
        getErrorMessage(requestError, "Không thể từ chối yêu cầu chat."),
      );
    } finally {
      setProcessingRequestId(null);
    }
  }

  async function handleCloseConversation() {
    if (!activeConversation || activeConversation.status !== "ACTIVE") {
      return;
    }

    if (
      !window.confirm(
        "Đóng cuộc trò chuyện này? Hai bên vẫn xem được lịch sử nhưng không thể gửi tin nhắn mới.",
      )
    ) {
      return;
    }

    setProcessingRequestId(activeConversation.id);
    setError(null);
    try {
      await closeDirectChatConversation(activeConversation.id);
      await loadConversations();
    } catch (requestError) {
      setError(
        getErrorMessage(requestError, "Không thể đóng cuộc trò chuyện."),
      );
    } finally {
      setProcessingRequestId(null);
    }
  }

  async function handleDeleteConversation(
    conversation: DirectChatConversation,
  ) {
    if (
      !window.confirm(
        "Xóa cuộc trò chuyện khỏi hộp thư của bạn? Kênh sẽ được đóng với cả hai bên, còn lịch sử vẫn được lưu.",
      )
    ) {
      return;
    }

    setProcessingRequestId(conversation.id);
    setError(null);
    try {
      await deleteDirectChatConversation(conversation.id);
      socketRef.current?.emit("conversation:leave", {
        conversationId: conversation.id,
      });
      setConversations((current) =>
        current.filter((item) => item.id !== conversation.id),
      );
      if (activeConversationIdRef.current === conversation.id) {
        activeConversationIdRef.current = null;
        setActiveConversationId(null);
        setMessages([]);
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Không thể ẩn cuộc trò chuyện."));
    } finally {
      setProcessingRequestId(null);
    }
  }

  function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    const socket = socketRef.current;

    if (!content || !activeConversation || !me || !socket?.connected) {
      return;
    }

    const clientMessageId = crypto.randomUUID();
    const optimisticMessage: DirectChatMessage = {
      id: -Date.now(),
      conversationId: activeConversation.id,
      senderId: me.id,
      clientMessageId,
      content,
      createdAt: new Date().toISOString(),
      readAt: null,
      sender: {
        id: me.id,
        fullName: me.fullName,
        role: me.role,
      },
    };
    setDraft("");
    setMessages((current) => mergeMessage(current, optimisticMessage));

    socket.emit(
      "message:send",
      {
        conversationId: activeConversation.id,
        content,
        clientMessageId,
      },
      (response: DirectChatSocketAck<DirectChatMessage>) => {
        if (!response.ok || !response.message) {
          setMessages((current) =>
            current.filter(
              (message) => message.clientMessageId !== clientMessageId,
            ),
          );
          setError(response.error ?? "Không thể gửi tin nhắn.");
          setDraft(content);
          return;
        }

        setMessages((current) => mergeMessage(current, response.message!));
      },
    );
  }

  function handleLogout() {
    localStorage.removeItem("accessToken");
    void logout().catch(() => null);
    window.location.replace("/login");
  }

  if (isLoading || !me) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-600">
        Đang tải hộp thư trực tiếp...
      </main>
    );
  }

  return (
    <main className="flex h-[100dvh] min-w-0 flex-col overflow-hidden bg-slate-50 text-slate-900">
      {notification ? (
        <NotificationToast
          notification={notification}
          onClose={() => setNotification(null)}
          onOpen={() => {
            const conversation = conversations.find(
              (item) => item.id === notification.conversationId,
            );
            if (
              conversation?.status === "ACTIVE" ||
              conversation?.status === "CLOSED"
            ) {
              void handleOpenConversation(conversation);
              setNotification(null);
            }
          }}
        />
      ) : null}

      <DoctorProfileDialog
        open={isDoctorProfileOpen}
        onClose={() => setIsDoctorProfileOpen(false)}
        onSaved={(profile: DoctorProfile) => {
          setMe((current) =>
            current
              ? {
                  ...current,
                  fullName: profile.fullName,
                  phoneNumber: profile.phoneNumber,
                  streetAddress: profile.streetAddress,
                  address: profile.address,
                  provinceCode: profile.provinceCode,
                  communeCode: profile.communeCode,
                }
              : current,
          );
        }}
      />

      <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() =>
              router.push(me.role === "DOCTOR" ? "/doctor" : "/chat")
            }
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            title={me.role === "DOCTOR" ? "Hộp thư bác sĩ" : "Quay lại chat AI"}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">
              {me.role === "DOCTOR" ? "Về hộp thư" : "Quay lại chat AI"}
            </span>
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold text-[#073b83] sm:text-lg">
              {me.role === "DOCTOR"
                ? "Hộp thư tư vấn bác sĩ"
                : "Chat trực tiếp với bác sĩ"}
            </h1>
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <Circle
                className={`h-2.5 w-2.5 fill-current ${
                  isConnected ? "text-emerald-500" : "text-amber-500"
                }`}
              />
              {isConnected ? "Realtime đang kết nối" : "Đang kết nối lại"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden max-w-44 truncate text-sm font-medium text-slate-600 sm:block">
            {me.fullName}
          </span>
          {me.role === "DOCTOR" ? (
            <button
              type="button"
              onClick={() => setIsDoctorProfileOpen(true)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
            >
              <UserRound className="h-4 w-4" />
              <span className="hidden sm:inline">Quản lý hồ sơ</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Đăng xuất</span>
          </button>
        </div>
      </header>

      {error ? (
        <div className="flex shrink-0 items-center justify-between bg-red-50 px-4 py-2 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <aside
          className={`min-h-0 w-full shrink-0 flex-col border-r border-slate-200 bg-white lg:flex lg:w-[360px] ${
            activeConversation ? "hidden" : "flex"
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
            <div>
              <h2 className="font-bold text-slate-900">Cuộc trò chuyện</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {conversations.length} yêu cầu và phiên chat
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadConversations()}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
              title="Làm mới"
            >
              <RefreshCcw className="h-4 w-4" />
            </button>
          </div>

          <div className="chat-scrollbar min-h-0 flex-1 overflow-y-auto p-3">
            {conversations.length === 0 ? (
              <EmptyInbox isDoctor={me.role === "DOCTOR"} />
            ) : null}

            {pendingConversations.length ? (
              <section className="mb-4">
                <h3 className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-amber-700">
                  Đang chờ xác nhận
                </h3>
                <div className="space-y-2">
                  {pendingConversations.map((conversation) => (
                    <PendingConversationCard
                      key={conversation.id}
                      conversation={conversation}
                      isDoctor={me.role === "DOCTOR"}
                      isProcessing={processingRequestId === conversation.id}
                      onAccept={() => void handleAccept(conversation)}
                      onReject={() => void handleReject(conversation)}
                      onDelete={() =>
                        void handleDeleteConversation(conversation)
                      }
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {otherConversations.length ? (
              <section>
                <h3 className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                  Phiên chat
                </h3>
                <div className="space-y-2">
                  {otherConversations.map((conversation) => (
                    <ConversationButton
                      key={conversation.id}
                      conversation={conversation}
                      viewerRole={me.role}
                      active={conversation.id === activeConversationId}
                      onClick={() => void handleOpenConversation(conversation)}
                      onDelete={() =>
                        void handleDeleteConversation(conversation)
                      }
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </aside>

        <section
          className={`min-w-0 flex-1 flex-col bg-[#fbfaf9] lg:flex ${
            activeConversation ? "flex" : "hidden"
          }`}
        >
          {activeConversation ? (
            <>
              <ChatHeader
                conversation={activeConversation}
                viewerRole={me.role}
                isProcessing={processingRequestId === activeConversation.id}
                onBack={() => {
                  socketRef.current?.emit("conversation:leave", {
                    conversationId: activeConversation.id,
                  });
                  activeConversationIdRef.current = null;
                  setActiveConversationId(null);
                  setMessages([]);
                }}
                onClose={() => void handleCloseConversation()}
                onDelete={() =>
                  void handleDeleteConversation(activeConversation)
                }
              />
              <div className="chat-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-8">
                <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
                  {isLoadingMessages ? (
                    <p className="text-center text-sm text-slate-500">
                      Đang tải tin nhắn...
                    </p>
                  ) : null}
                  {!isLoadingMessages && messages.length === 0 ? (
                    <div className="mx-auto mt-12 max-w-md rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-6 text-center">
                      <MessageCircle className="mx-auto h-8 w-8 text-emerald-600" />
                      <p className="mt-3 text-sm font-semibold text-slate-800">
                        Yêu cầu đã được chấp nhận
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-500">
                        Hãy gửi lời chào để bắt đầu cuộc trò chuyện trực tiếp.
                      </p>
                    </div>
                  ) : null}
                  {messages.map((message) => (
                    <MessageBubble
                      key={message.clientMessageId}
                      message={message}
                      own={message.senderId === me.id}
                    />
                  ))}
                  <div ref={messageEndRef} />
                </div>
              </div>
              <form
                onSubmit={handleSend}
                className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 sm:px-8"
              >
                <div className="mx-auto flex w-full max-w-3xl items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        !event.shiftKey &&
                        !event.nativeEvent.isComposing
                      ) {
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }
                    }}
                    rows={1}
                    maxLength={2000}
                    disabled={
                      activeConversation.status !== "ACTIVE" || !isConnected
                    }
                    placeholder={
                      activeConversation.status === "CLOSED"
                        ? "Cuộc trò chuyện đã đóng"
                        : isConnected
                          ? "Nhập tin nhắn..."
                          : "Đang kết nối lại realtime..."
                    }
                    className="max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100"
                  />
                  <button
                    type="submit"
                    disabled={
                      !draft.trim() ||
                      activeConversation.status !== "ACTIVE" ||
                      !isConnected
                    }
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#073f87] text-white transition hover:bg-[#052f66] disabled:cursor-not-allowed disabled:bg-slate-300"
                    title="Gửi tin nhắn"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex h-full items-center justify-center p-6">
              <div className="max-w-sm text-center">
                <MessageCircle className="mx-auto h-12 w-12 text-slate-300" />
                <h2 className="mt-4 text-lg font-bold text-slate-800">
                  Chọn một phiên chat
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Tin nhắn mới sẽ được thông báo ngay khi hai bên đang đăng
                  nhập.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function PendingConversationCard({
  conversation,
  isDoctor,
  isProcessing,
  onAccept,
  onReject,
  onDelete,
}: {
  conversation: DirectChatConversation;
  isDoctor: boolean;
  isProcessing: boolean;
  onAccept: () => void;
  onReject: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
      <div className="flex items-start gap-3">
        <PersonAvatar
          name={
            isDoctor
              ? conversation.patient.fullName
              : conversation.doctor.fullName
          }
          imageUrl={isDoctor ? null : conversation.doctor.imageUrl}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-amber-700 ring-1 ring-amber-200"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-900">
            {isDoctor
              ? conversation.patient.fullName
              : conversation.doctor.fullName}
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
            <Clock3 className="h-3.5 w-3.5" />
            {formatDateTime(conversation.requestedAt)}
          </p>
        </div>
      </div>
      {isDoctor ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={isProcessing}
            onClick={onAccept}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            <Check className="h-3.5 w-3.5" />
            Chấp nhận
          </button>
          <button
            type="button"
            disabled={isProcessing}
            onClick={onReject}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
          >
            <X className="h-3.5 w-3.5" />
            Từ chối
          </button>
        </div>
      ) : (
        <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-medium text-amber-700 ring-1 ring-amber-100">
          Đang chờ bác sĩ phản hồi
        </p>
      )}
      <button
        type="button"
        disabled={isProcessing}
        onClick={onDelete}
        className="mt-2 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Ẩn yêu cầu
      </button>
    </article>
  );
}

function ConversationButton({
  conversation,
  viewerRole,
  active,
  onClick,
  onDelete,
}: {
  conversation: DirectChatConversation;
  viewerRole: AuthUser["role"];
  active: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  const counterpart =
    viewerRole === "DOCTOR"
      ? conversation.patient.fullName
      : conversation.doctor.fullName;

  return (
    <div
      className={`flex w-full items-stretch gap-2 rounded-xl border p-2 transition ${
        active
          ? "border-brand-300 bg-brand-50"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <button
        type="button"
        disabled={
          conversation.status !== "ACTIVE" && conversation.status !== "CLOSED"
        }
        onClick={onClick}
        className="min-w-0 flex-1 rounded-lg p-1 text-left disabled:cursor-default disabled:opacity-70"
      >
        <div className="flex items-start gap-3">
          <PersonAvatar
            name={counterpart}
            imageUrl={
              viewerRole === "DOCTOR" ? null : conversation.doctor.imageUrl
            }
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-700"
          />
          <span className="min-w-0 flex-1">
            <span className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-bold text-slate-900">
                {counterpart}
              </span>
              {conversation.unreadCount > 0 ? (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {conversation.unreadCount}
                </span>
              ) : null}
            </span>
            <span className="mt-1 block truncate text-xs text-slate-500">
              {conversation.status === "CLOSED"
                ? "Phiên chat đã được đóng"
                : (conversation.lastMessage?.content ??
                  getStatusLabel(conversation.status))}
            </span>
          </span>
        </div>
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="flex h-9 w-9 shrink-0 items-center justify-center self-start rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
        title="Ẩn khỏi hộp thư"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function ChatHeader({
  conversation,
  viewerRole,
  isProcessing,
  onBack,
  onClose,
  onDelete,
}: {
  conversation: DirectChatConversation;
  viewerRole: AuthUser["role"];
  isProcessing: boolean;
  onBack: () => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const counterpart =
    viewerRole === "DOCTOR"
      ? conversation.patient.fullName
      : conversation.doctor.fullName;

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
      <button
        type="button"
        onClick={onBack}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden"
        title="Quay lại danh sách"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      <PersonAvatar
        name={counterpart}
        imageUrl={viewerRole === "DOCTOR" ? null : conversation.doctor.imageUrl}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-sm font-bold text-emerald-700"
      />
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-sm font-bold text-slate-900 sm:text-base">
          {counterpart}
        </h2>
        <p className="truncate text-xs text-slate-500">
          {viewerRole === "DOCTOR"
            ? conversation.patient.email
            : `${conversation.doctor.specialty.name} · ${
                conversation.doctor.workplace ?? "Chưa cập nhật nơi làm việc"
              }`}
        </p>
      </div>
      {conversation.status === "CLOSED" ? (
        <span className="hidden rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600 sm:inline-flex">
          Đã đóng
        </span>
      ) : null}
      <div className="flex shrink-0 items-center gap-1">
        {conversation.status === "ACTIVE" ? (
          <button
            type="button"
            disabled={isProcessing}
            onClick={onClose}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-200 px-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-50 disabled:opacity-50 sm:px-3 sm:text-sm"
            title="Đóng cuộc trò chuyện"
          >
            <Archive className="h-4 w-4" />
            <span className="hidden sm:inline">Đóng chat</span>
          </button>
        ) : null}
        <button
          type="button"
          disabled={isProcessing}
          onClick={onDelete}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 px-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50 sm:px-3 sm:text-sm"
          title="Ẩn khỏi hộp thư"
        >
          <Trash2 className="h-4 w-4" />
          <span className="hidden sm:inline">Xóa</span>
        </button>
      </div>
    </header>
  );
}

function MessageBubble({
  message,
  own,
}: {
  message: DirectChatMessage;
  own: boolean;
}) {
  const consultationSummary = parseConsultationSummary(message.content);

  return (
    <div className={`flex ${own ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[82%] sm:max-w-[72%]">
        <div
          className={`break-words rounded-2xl px-4 py-2.5 text-sm leading-6 shadow-sm ${
            own
              ? "rounded-br-md bg-[#073f87] text-white"
              : "rounded-bl-md border border-slate-200 bg-white text-slate-800"
          }`}
        >
          {consultationSummary ? (
            <ConsultationSummaryCard items={consultationSummary} own={own} />
          ) : (
            <p className="whitespace-pre-line">{message.content}</p>
          )}
        </div>
        <p
          className={`mt-1 text-[11px] text-slate-400 ${
            own ? "text-right" : "text-left"
          }`}
        >
          {formatTime(message.createdAt)}
          {own ? ` · ${message.readAt ? "Đã xem" : "Đã gửi"}` : ""}
        </p>
      </div>
    </div>
  );
}

interface ConsultationSummaryItem {
  label: string;
  value: string;
}

function ConsultationSummaryCard({
  items,
  own,
}: {
  items: ConsultationSummaryItem[];
  own: boolean;
}) {
  return (
    <section
      className={`min-w-[260px] rounded-xl border p-3.5 sm:min-w-[320px] ${
        own ? "border-blue-300/40 bg-white/10" : "border-blue-100 bg-blue-50/60"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            own ? "bg-white/15 text-white" : "bg-blue-100 text-blue-700"
          }`}
        >
          <ClipboardList className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold">Thông tin khám từ HealthAI</p>
          <p
            className={`mt-0.5 text-xs ${
              own ? "text-blue-100" : "text-slate-500"
            }`}
          >
            Thông tin người bệnh đã chọn gửi
          </p>
        </div>
      </div>

      <div
        className={`mt-3 divide-y rounded-lg border ${
          own
            ? "divide-white/10 border-white/15 bg-white/10"
            : "divide-slate-200 border-blue-100 bg-white"
        }`}
      >
        {items.map((item) => (
          <div
            key={`${item.label}-${item.value}`}
            className="grid gap-0.5 px-3 py-2 sm:grid-cols-[minmax(120px,0.42fr)_minmax(0,1fr)] sm:gap-3"
          >
            <span
              className={`text-xs font-semibold ${
                own ? "text-blue-100" : "text-slate-500"
              }`}
            >
              {item.label}
            </span>
            <span className="break-words text-sm font-semibold">
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function parseConsultationSummary(content: string) {
  const lines = content.split(/\r?\n/);
  if (lines[0]?.trim() !== "Thông tin đã chọn từ HealthAI:") {
    return null;
  }

  const items = lines
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separatorIndex = line.indexOf(":");
      if (separatorIndex < 0) {
        return null;
      }

      const label = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();
      return label && value ? { label, value } : null;
    })
    .filter((item): item is ConsultationSummaryItem => item !== null);

  return items.length ? items : null;
}

function NotificationToast({
  notification,
  onClose,
  onOpen,
}: {
  notification: DirectChatNotification;
  onClose: () => void;
  onOpen: () => void;
}) {
  return (
    <div className="fixed right-3 top-3 z-[80] w-[calc(100%-1.5rem)] max-w-sm rounded-xl border border-emerald-200 bg-white p-4 shadow-2xl">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
          <MessageCircle className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900">
            {notification.title}
          </p>
          <p className="mt-1 break-words text-sm leading-5 text-slate-600">
            {notification.message}
          </p>
          {notification.conversationId ? (
            <button
              type="button"
              onClick={onOpen}
              className="mt-2 text-xs font-bold text-emerald-700 hover:text-emerald-800"
            >
              Mở cuộc trò chuyện
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-700"
          title="Đóng thông báo"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function EmptyInbox({ isDoctor }: { isDoctor: boolean }) {
  return (
    <div className="mt-8 rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center">
      <MessageCircle className="mx-auto h-8 w-8 text-slate-300" />
      <p className="mt-3 text-sm font-semibold text-slate-700">
        Chưa có cuộc trò chuyện
      </p>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        {isDoctor
          ? "Yêu cầu mới từ người dùng sẽ xuất hiện tại đây."
          : "Hãy gửi yêu cầu từ thẻ bác sĩ trong kết quả tư vấn AI."}
      </p>
    </div>
  );
}

function mergeMessage(
  messages: DirectChatMessage[],
  nextMessage: DirectChatMessage,
) {
  const merged = [
    ...messages.filter(
      (message) => message.clientMessageId !== nextMessage.clientMessageId,
    ),
    nextMessage,
  ];

  return merged.sort(
    (first, second) =>
      new Date(first.createdAt).getTime() -
      new Date(second.createdAt).getTime(),
  );
}

function getStatusLabel(status: DirectChatConversation["status"]) {
  switch (status) {
    case "ACTIVE":
      return "Đang hoạt động";
    case "REJECTED":
      return "Đã từ chối";
    case "CLOSED":
      return "Đã kết thúc";
    default:
      return "Đang chờ xác nhận";
  }
}

function PersonAvatar({
  name,
  imageUrl,
  className,
}: {
  name: string;
  imageUrl: string | null;
  className: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(imageUrl) && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  return (
    <span className={`relative overflow-hidden ${className}`} title={name}>
      {showImage ? (
        <img
          src={imageUrl ?? undefined}
          alt={`Ảnh đại diện của ${name}`}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
      ) : (
        getInitials(name) || <UserRound className="h-4 w-4" />
      )}
    </span>
  );
}

function getInitials(value: string) {
  return value
    .replace(/^Bác sĩ\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
