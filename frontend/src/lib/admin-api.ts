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
  role: 'ADMIN' | 'USER' | 'DOCTOR';
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

export type DoctorConsultationType = 'OFFLINE' | 'ONLINE';

export interface DoctorCreationOptions {
  specialties: Array<{
    id: number;
    code: string;
    name: string;
  }>;
  consultationTypes: DoctorConsultationType[];
}

export interface CreateDoctorAccountInput {
  fullName: string;
  email: string;
  password: string;
  dateOfBirth?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN';
  specialtyId: number;
  academicTitle?: string;
  experienceYears?: number;
  workplace?: string;
  phoneNumber?: string;
  streetAddress: string;
  provinceCode: number;
  communeCode: number;
  imageUrl?: string;
  imageFile?: File | null;
  workingTime?: string;
  description?: string;
  consultationType: DoctorConsultationType[];
}

export function getDoctorCreationOptions() {
  return apiRequest<DoctorCreationOptions>('/users/admin/doctor-options');
}

export function createDoctorAccount(input: CreateDoctorAccountInput) {
  const formData = new FormData();
  formData.set('fullName', input.fullName);
  formData.set('email', input.email);
  formData.set('password', input.password);
  formData.set('gender', input.gender ?? 'UNKNOWN');
  formData.set('specialtyId', String(input.specialtyId));
  formData.set('experienceYears', String(input.experienceYears ?? 0));
  formData.set('streetAddress', input.streetAddress);
  formData.set('provinceCode', String(input.provinceCode));
  formData.set('communeCode', String(input.communeCode));
  formData.set('consultationType', JSON.stringify(input.consultationType));

  const optionalFields = [
    'dateOfBirth',
    'academicTitle',
    'workplace',
    'phoneNumber',
    'workingTime',
    'description',
    'imageUrl',
  ] as const;

  for (const field of optionalFields) {
    const value = input[field];
    if (typeof value === 'string' && value.trim()) {
      formData.set(field, value);
    }
  }

  if (input.imageFile) {
    formData.set('image', input.imageFile);
  }

  return apiRequest('/users/admin/doctors', {
    method: 'POST',
    body: formData,
  });
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
