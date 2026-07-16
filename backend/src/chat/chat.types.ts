export interface ModelSymptom {
  name: string;
  confidence: number;
  specialty_code: string;
}

export interface ModelAnalyzeResponse {
  symptoms: ModelSymptom[];
  specialties: string[];
  message: string;
}

export interface SpecialtyHint {
  code: string;
  name: string;
  keywords: string[];
}

export interface RecommendedSpecialty {
  id: number | null;
  code: string;
  name: string;
}

export interface RecommendedDoctor {
  id: number;
  fullName: string;
  academicTitle: string | null;
  experienceYears: number;
  workplace: string | null;
  streetAddress: string | null;
  address: string | null;
  city: string | null;
  provinceCode: number | null;
  districtCode: number | null;
  wardCode: number | null;
  phoneNumber: string | null;
  email: string | null;
  workingTime: string | null;
  consultationType: string[];
  rating: string | null;
  distanceText: string | null;
  distanceMeters: number | null;
  durationText: string | null;
  durationSeconds: number | null;
  specialtyScore: number;
  expertiseScore: number;
  experienceScore: number;
  locationScore: number | null;
  ratingScore: number;
  doctorScore: number;
}

export interface RecommendedSpecialtyWithDoctors
  extends RecommendedSpecialty {
  doctors: RecommendedDoctor[];
}
