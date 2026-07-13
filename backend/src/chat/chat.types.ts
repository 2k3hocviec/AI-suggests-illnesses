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
