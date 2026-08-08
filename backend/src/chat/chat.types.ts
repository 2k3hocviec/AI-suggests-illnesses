export interface ModelSymptom {
  name: string;
  confidence: number;
  specialty_code: string;
}

export type ModelIntent =
  "SYMPTOM" | "GREETING" | "THANKS" | "GOODBYE" | "UNKNOWN";

export type ModelAction = "FIND_DOCTORS" | "REPLY" | "CLARIFY";

export type LocalReasoningAction =
  | "ASK_FOLLOW_UP"
  | "FIND_DOCTORS"
  | "EMERGENCY"
  | "REPLY"
  | "CLARIFY";

export type LocalReasoningField = "NONE" | ClinicalField;

export interface LocalReasoningResponse {
  nextAction: LocalReasoningAction;
  field: LocalReasoningField;
  confidence: number;
  source?: "RULE" | "MODEL";
  question?: string;
}

export interface ChatHistoryMessage {
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
}

export type ClinicalField = "duration" | "severity" | "age";

export interface ClinicalSlot {
  text: string;
  value?: number;
  unit?: "HOUR" | "DAY" | "WEEK" | "MONTH" | "YEAR";
  confidence?: number;
}

export interface ClinicalSlots {
  duration: ClinicalSlot | null;
  severity: ClinicalSlot | null;
  age: ClinicalSlot | null;
}

export interface ModelRedFlag {
  code: string;
  text: string;
  confidence: number;
}

export interface ModelAnalyzeResponse {
  symptoms: ModelSymptom[];
  specialties: string[];
  intent: ModelIntent;
  action: ModelAction;
  slots: ClinicalSlots;
  redFlags: ModelRedFlag[];
  missingFields: ClinicalField[];
  followUpQuestion: string | null;
  readyForRecommendation: boolean;
  analysisSource?: "NER" | "Gemini";
  nextAction?: LocalReasoningAction;
  field?: LocalReasoningField;
  confidence?: number;
  policySource?: "MODEL" | "RULE";
  repeatDetected?: boolean;
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
  chatAvailable: boolean;
  fullName: string;
  imageUrl: string | null;
  academicTitle: string | null;
  experienceYears: number;
  workplace: string | null;
  streetAddress: string | null;
  address: string | null;
  city: string | null;
  provinceCode: number | null;
  communeCode: number | null;
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
  experienceScore: number;
  locationScore: number | null;
  ratingScore: number;
  doctorScore: number;
}

export interface RecommendedSpecialtyWithDoctors extends RecommendedSpecialty {
  doctors: RecommendedDoctor[];
}
