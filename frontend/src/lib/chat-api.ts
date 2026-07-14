import { apiRequest } from './http';

export interface ChatMessage {
  id: number;
  sessionId: number;
  userId: number | null;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  metadata: unknown;
  createdAt: string;
}

export interface ChatSpecialty {
  id: number | null;
  code: string;
  name: string;
}

export interface ChatDoctor {
  id: number;
  fullName: string;
  academicTitle: string | null;
  experienceYears: number;
  workplace: string | null;
  address: string | null;
  city: string | null;
  phoneNumber: string | null;
  email: string | null;
  workingTime: string | null;
  consultationType: string[];
  rating: string | null;
}

export interface ChatSpecialtyWithDoctors extends ChatSpecialty {
  doctors: ChatDoctor[];
}

export interface ChatSession {
  id: number;
  title: string | null;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  _count: {
    messages: number;
  };
}

export interface SendChatMessageResponse {
  session: {
    id: number;
    title: string | null;
  };
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  analysis: {
    symptoms: Array<{
      name: string;
      confidence: number;
      specialty_code: string;
    }>;
    specialties: string[];
    message: string;
    recommendedSpecialty: ChatSpecialty | null;
    recommendedSpecialties: ChatSpecialtyWithDoctors[];
  };
}

export function sendChatMessage(message: string, sessionId?: number) {
  return apiRequest<SendChatMessageResponse>('/chat/messages', {
    method: 'POST',
    json: {
      message,
      sessionId,
    },
  });
}

export function listChatSessions() {
  return apiRequest<ChatSession[]>('/chat/sessions');
}

export function listChatMessages(sessionId: number) {
  return apiRequest<ChatMessage[]>(`/chat/sessions/${sessionId}/messages`);
}
