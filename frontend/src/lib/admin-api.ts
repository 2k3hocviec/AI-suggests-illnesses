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

export function getAdminOverview() {
  return apiRequest<AdminOverview>('/users/admin/overview');
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
