import { io, Socket } from 'socket.io-client';
import { apiRequest, API_BASE_URL } from './http';

export type DirectChatStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'CLOSED';

export interface DirectChatPerson {
  id: number;
  fullName: string;
  email: string;
}

export interface DirectChatDoctor {
  id: number;
  fullName: string;
  academicTitle: string | null;
  email: string | null;
  phoneNumber: string | null;
  workplace: string | null;
  specialty: {
    id: number;
    code: string;
    name: string;
  };
}

export interface DirectChatLastMessage {
  id: number;
  senderId: number;
  content: string;
  createdAt: string;
  readAt: string | null;
}

export interface DirectChatConversation {
  id: number;
  status: DirectChatStatus;
  requestedAt: string;
  respondedAt: string | null;
  closedAt: string | null;
  updatedAt: string;
  patient: DirectChatPerson;
  doctor: DirectChatDoctor;
  lastMessage: DirectChatLastMessage | null;
  unreadCount: number;
}

export interface DirectChatMessage {
  id: number;
  conversationId: number;
  senderId: number;
  clientMessageId: string;
  content: string;
  createdAt: string;
  readAt: string | null;
  sender: {
    id: number;
    fullName: string;
    role: 'USER' | 'DOCTOR' | 'ADMIN';
  };
}

export interface DirectChatNotification {
  type: 'REQUEST' | 'REQUEST_ACCEPTED' | 'REQUEST_REJECTED' | 'MESSAGE';
  title: string;
  message: string;
  conversationId?: number;
  createdAt: string;
}

export interface DirectChatSocketAck<T = undefined> {
  ok: boolean;
  error?: string;
  message?: T;
  conversationId?: number;
}

export function requestDoctorChat(doctorId: number) {
  return apiRequest<{
    created: boolean;
    conversation: DirectChatConversation;
  }>('/direct-chat/requests', {
    method: 'POST',
    json: {
      doctorId,
    },
  });
}

export function listDirectChatConversations() {
  return apiRequest<DirectChatConversation[]>('/direct-chat/conversations');
}

export function listDirectChatMessages(conversationId: number) {
  return apiRequest<DirectChatMessage[]>(
    `/direct-chat/conversations/${conversationId}/messages`,
  );
}

export function acceptDirectChatRequest(conversationId: number) {
  return apiRequest<DirectChatConversation>(
    `/direct-chat/conversations/${conversationId}/accept`,
    {
      method: 'PATCH',
    },
  );
}

export function rejectDirectChatRequest(conversationId: number) {
  return apiRequest<DirectChatConversation>(
    `/direct-chat/conversations/${conversationId}/reject`,
    {
      method: 'PATCH',
    },
  );
}

export function markDirectChatRead(conversationId: number) {
  return apiRequest<{
    conversationId: number;
    readerId: number;
    readAt: string;
    count: number;
  }>(`/direct-chat/conversations/${conversationId}/read`, {
    method: 'PATCH',
  });
}

export function createDirectChatSocket(): Socket {
  const accessToken =
    typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const configuredUrl = process.env.NEXT_PUBLIC_WS_URL?.replace(/\/+$/, '');
  const fallbackUrl = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

  return io(`${configuredUrl ?? fallbackUrl}/direct-chat`, {
    auth: {
      token: accessToken,
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
  });
}
