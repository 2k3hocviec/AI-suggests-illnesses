'use client';

import { Archive, History, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { ChatSession } from '@/lib/chat-api';

interface ChatHistoryDialogProps {
  isOpen: boolean;
  sessions: ChatSession[];
  activeSessionId?: number;
  isLoading?: boolean;
  onClose: () => void;
  onSelectSession: (sessionId: number) => void;
  onCloseSession: (sessionId: number) => Promise<void> | void;
  onDeleteSession: (sessionId: number) => Promise<void> | void;
}

export function ChatHistoryDialog({
  isOpen,
  sessions,
  activeSessionId,
  isLoading = false,
  onClose,
  onSelectSession,
  onCloseSession,
  onDeleteSession,
}: ChatHistoryDialogProps) {
  const [processingSessionId, setProcessingSessionId] = useState<number | null>(
    null,
  );

  if (!isOpen) {
    return null;
  }

  function handleSelectSession(sessionId: number) {
    onSelectSession(sessionId);
    onClose();
  }

  async function handleCloseSession(sessionId: number) {
    setProcessingSessionId(sessionId);
    try {
      await onCloseSession(sessionId);
    } finally {
      setProcessingSessionId(null);
    }
  }

  async function handleDeleteSession(sessionId: number) {
    setProcessingSessionId(sessionId);
    try {
      await onDeleteSession(sessionId);
    } finally {
      setProcessingSessionId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
      <div className="flex max-h-[86vh] w-full max-w-4xl flex-col rounded-lg border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Lịch sử chat
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Chọn một phiên chat để xem lại nội dung tư vấn.
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Đóng lịch sử chat"
            title="Đóng"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {isLoading ? (
            <p className="px-5 py-6 text-sm text-slate-500">
              Đang tải lịch sử...
            </p>
          ) : null}

          {!isLoading && sessions.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-500">
              Chưa có phiên chat nào.
            </p>
          ) : null}

          {!isLoading && sessions.length > 0 ? (
            <table className="w-full min-w-[680px] border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="border-b border-slate-200 px-5 py-3">
                    Phiên chat
                  </th>
                  <th className="w-32 border-b border-slate-200 px-4 py-3">
                    Tin nhắn
                  </th>
                  <th className="w-44 border-b border-slate-200 px-4 py-3">
                    Cập nhật
                  </th>
                  <th className="w-56 border-b border-slate-200 px-5 py-3 text-right">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => {
                  const isActive = session.id === activeSessionId;

                  return (
                    <tr
                      key={session.id}
                      className={
                        isActive
                          ? 'bg-brand-50/70'
                          : 'transition hover:bg-slate-50'
                      }
                    >
                      <td className="border-b border-slate-100 px-5 py-3">
                        <p className="max-w-md truncate font-semibold text-slate-900">
                          {session.title || 'Phiên chat mới'}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Tạo lúc {formatSessionTime(session.createdAt)}
                        </p>
                      </td>
                      <td className="border-b border-slate-100 px-4 py-3 text-slate-700">
                        {session._count.messages}
                      </td>
                      <td className="border-b border-slate-100 px-4 py-3 text-slate-600">
                        {formatSessionTime(session.updatedAt)}
                      </td>
                      <td className="border-b border-slate-100 px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleSelectSession(session.id)}
                            className={
                              isActive
                                ? 'rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white'
                                : 'rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-brand-500 hover:text-brand-700'
                            }
                          >
                            {isActive ? 'Đang xem' : 'Mở'}
                          </button>
                          {!session.closedAt ? (
                            <button
                              type="button"
                              disabled={processingSessionId === session.id}
                              onClick={() => void handleCloseSession(session.id)}
                              className="inline-flex h-8 items-center gap-1 rounded-md border border-amber-200 px-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-50 disabled:opacity-50"
                              title="Đóng phiên chat"
                            >
                              <Archive className="h-3.5 w-3.5" />
                              Đóng
                            </button>
                          ) : null}
                          <button
                            type="button"
                            disabled={processingSessionId === session.id}
                            onClick={() => {
                              if (
                                window.confirm(
                                  'Ẩn phiên chat này khỏi lịch sử? Nội dung vẫn được lưu trong hệ thống.',
                                )
                              ) {
                                void handleDeleteSession(session.id);
                              }
                            }}
                            className="inline-flex h-8 items-center gap-1 rounded-md border border-red-200 px-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                            title="Ẩn khỏi lịch sử"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function formatSessionTime(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
