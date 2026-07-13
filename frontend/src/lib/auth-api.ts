import { apiRequest } from './http';

export interface AuthUser {
  id: number;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  address: string | null;
  gender: string;
  role: 'ADMIN' | 'USER';
  dateOfBirth: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshTokenExpiresAt: string;
  user: AuthUser;
}

export interface RegisterResponse {
  message: string;
  user: AuthUser;
}

export interface MessageResponse {
  message: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  fullName: string;
  email: string;
  password: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN';
  address?: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  email: string;
  otp: string;
  newPassword: string;
}

export function login(payload: LoginRequest) {
  return apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    json: payload,
  });
}

export function register(payload: RegisterRequest) {
  return apiRequest<RegisterResponse>('/auth/register', {
    method: 'POST',
    json: payload,
  });
}

export function forgotPassword(payload: ForgotPasswordRequest) {
  return apiRequest<MessageResponse>('/auth/forgot-password', {
    method: 'POST',
    json: payload,
  });
}

export function resetPassword(payload: ResetPasswordRequest) {
  return apiRequest<MessageResponse>('/auth/reset-password', {
    method: 'POST',
    json: payload,
  });
}

export function refreshToken() {
  return apiRequest<AuthResponse>('/auth/refresh', {
    method: 'POST',
  });
}

export function logout() {
  return apiRequest<{ message: string }>('/auth/logout', {
    method: 'POST',
  });
}
