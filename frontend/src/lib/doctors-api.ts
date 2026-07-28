import { apiRequest } from './http';

export type DoctorConsultationType = 'ONLINE' | 'OFFLINE';

export interface DoctorProfile {
  id: number;
  fullName: string;
  academicTitle: string | null;
  experienceYears: number;
  description: string | null;
  phoneNumber: string | null;
  email: string | null;
  workplace: string | null;
  streetAddress: string | null;
  address: string | null;
  city: string | null;
  provinceCode: number | null;
  communeCode: number | null;
  workingTime: string | null;
  imageUrl: string | null;
  rating: string | null;
  consultationType: DoctorConsultationType[];
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
  specialty: {
    id: number;
    code: string;
    name: string;
    description: string | null;
  };
  user: {
    gender: string;
    dateOfBirth: string | null;
  } | null;
}

export interface UpdateDoctorProfileInput {
  fullName: string;
  academicTitle: string;
  experienceYears: number;
  workplace: string;
  phoneNumber: string;
  streetAddress: string;
  provinceCode: number;
  communeCode: number;
  workingTime: string;
  description: string;
  consultationType: DoctorConsultationType[];
  imageFile?: File | null;
}

export function getDoctorProfile(id: number) {
  return apiRequest<DoctorProfile>(`/doctors/${id}`);
}

export function getMyDoctorProfile() {
  return apiRequest<DoctorProfile>('/doctors/me');
}

export function updateMyDoctorProfile(input: UpdateDoctorProfileInput) {
  const formData = new FormData();
  formData.set('fullName', input.fullName);
  formData.set('academicTitle', input.academicTitle);
  formData.set('experienceYears', String(input.experienceYears));
  formData.set('workplace', input.workplace);
  formData.set('phoneNumber', input.phoneNumber);
  formData.set('streetAddress', input.streetAddress);
  formData.set('provinceCode', String(input.provinceCode));
  formData.set('communeCode', String(input.communeCode));
  formData.set('workingTime', input.workingTime);
  formData.set('description', input.description);
  formData.set('consultationType', JSON.stringify(input.consultationType));

  if (input.imageFile) {
    formData.set('image', input.imageFile);
  }

  return apiRequest<DoctorProfile>('/doctors/me', {
    method: 'PATCH',
    body: formData,
  });
}
