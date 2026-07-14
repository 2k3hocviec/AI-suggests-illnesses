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
  address: string | null;
  city: string | null;
  phoneNumber: string | null;
  email: string | null;
  workingTime: string | null;
  consultationType: string[];
  rating: string | null;
}

export interface RecommendedSpecialtyWithDoctors
  extends RecommendedSpecialty {
  doctors: RecommendedDoctor[];
}
