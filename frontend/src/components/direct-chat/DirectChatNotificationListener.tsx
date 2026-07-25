'use client';

import { MessageCircle, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  createDirectChatSocket,
  DirectChatNotification,
} from '@/lib/direct-chat-api';

export function DirectChatNotificationListener() {
  const router = useRouter();
  const [notification, setNotification] =
    useState<DirectChatNotification | null>(null);

  useEffect(() => {
    const socket = createDirectChatSocket();
    socket.on('notification:new', setNotification);

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!notification) {
      return;
    }

    const timeout = window.setTimeout(() => setNotification(null), 6500);
    return () => window.clearTimeout(timeout);
  }, [notification]);

  if (!notification) {
    return null;
  }

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
          <button
            type="button"
            onClick={() => router.push('/direct-chat')}
            className="mt-2 text-xs font-bold text-emerald-700 hover:text-emerald-800"
          >
            Mở hộp thư bác sĩ
          </button>
        </div>
        <button
          type="button"
          onClick={() => setNotification(null)}
          className="text-slate-400 hover:text-slate-700"
          title="Đóng thông báo"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
