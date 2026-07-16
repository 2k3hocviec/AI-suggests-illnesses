import { UserGender, UserRole } from '@prisma/client';

export interface JwtUserPayload {
  sub: number;
  email: string;
}

export interface RequestContext {
  userAgent?: string;
  ipAddress?: string;
}

export interface AuthenticatedUser {
  id: number;
  email: string;
  role: UserRole;
}

export interface PublicUser {
  id: number;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  streetAddress: string | null;
  address: string | null;
  provinceCode: number | null;
  districtCode: number | null;
  wardCode: number | null;
  gender: UserGender;
  role: UserRole;
  isEnabled: boolean;
  dateOfBirth: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
