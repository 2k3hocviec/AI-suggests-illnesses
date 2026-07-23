import { apiRequest } from './http';

export interface AdminOverview {
  totals: {
    users: number;
    enabledUsers: number;
    disabledUsers: number;
    chatSessions: number;
    messages: number;
    modelRequests: number;
  };
  roleBreakdown: Array<{ label: string; value: number }>;
  statusBreakdown: Array<{ label: string; value: number }>;
  dailyActivity: Array<{ date: string; users: number; messages: number }>;
  ai: {
    totalConsultations: number;
    unrecognizedCases: number;
    topSymptoms: Array<{ name: string; count: number }>;
    topSpecialties: Array<{ code: string; name: string; count: number }>;
    sourceBreakdown: Array<{ label: 'NER' | 'Gemini'; value: number }>;
  };
}

export interface AdminUser {
  id: number;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  address: string | null;
  role: 'ADMIN' | 'USER';
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  _count: {
    chatSessions: number;
    chatMessages: number;
    consultationHistories: number;
  };
}

export interface AdminUsersResponse {
  items: AdminUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function getAdminOverview(params: { from?: string; to?: string } = {}) {
  const query = new URLSearchParams();

  if (params.from) {
    query.set('from', params.from);
  }

  if (params.to) {
    query.set('to', params.to);
  }

  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiRequest<AdminOverview>(`/users/admin/overview${suffix}`);
}

export function listAdminUsers(params: { search?: string; page?: number }) {
  const query = new URLSearchParams();

  if (params.search) {
    query.set('search', params.search);
  }

  if (params.page) {
    query.set('page', String(params.page));
  }

  query.set('limit', '12');

  return apiRequest<AdminUsersResponse>(`/users/admin?${query.toString()}`);
}

export function setUserEnabled(userId: number, isEnabled: boolean) {
  return apiRequest<Pick<AdminUser, 'id' | 'fullName' | 'email' | 'role' | 'isEnabled' | 'updatedAt'>>(
    `/users/admin/${userId}/status`,
    {
      method: 'PATCH',
      json: {
        isEnabled,
      },
    },
  );
}

export interface AdminModelTestResponse {
  symptoms: Array<{
    name: string;
    confidence: number;
    specialty_code: string;
  }>;
  specialties: string[];
  intent: string;
  action: string;
  analysisSource?: 'NER' | 'Gemini';
}

export function testAdminModel(message: string) {
  return apiRequest<AdminModelTestResponse>('/chat/admin/model-test', {
    method: 'POST',
    json: {
      message,
    },
  });
}
