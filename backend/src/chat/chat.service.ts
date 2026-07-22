import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ChatRole, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { SendChatMessageDto } from "./dto/send-chat-message.dto";
import {
  ModelAnalyzeResponse,
  ModelSymptom,
  RecommendedDoctor,
  RecommendedSpecialty,
  RecommendedSpecialtyWithDoctors,
  SpecialtyHint,
} from "./chat.types";

const SPECIALTY_HINTS: SpecialtyHint[] = [
  {
    code: "CARDIOLOGY",
    name: "Tim mạch",
    keywords: ["đau ngực", "tim đập nhanh", "hồi hộp", "khó thở", "tức ngực"],
  },
  {
    code: "RESPIRATORY",
    name: "Hô hấp",
    keywords: ["ho", "khó thở", "đờm", "khò khè", "đau họng"],
  },
  {
    code: "NEUROLOGY",
    name: "Thần kinh",
    keywords: ["đau đầu", "chóng mặt", "tê", "co giật", "mất ngủ"],
  },
  {
    code: "GASTROENTEROLOGY",
    name: "Tiêu hóa",
    keywords: ["đau bụng", "buồn nôn", "nôn", "tiêu chảy", "táo bón"],
  },
  {
    code: "DERMATOLOGY",
    name: "Da liễu",
    keywords: ["ngứa", "phát ban", "mụn", "nổi mẩn", "dị ứng da"],
  },
  {
    code: "ENT",
    name: "Tai Mũi Họng",
    keywords: ["đau tai", "nghẹt mũi", "sổ mũi", "ù tai", "viêm họng"],
  },
  {
    code: "GENERAL_MEDICINE",
    name: "Nội khoa",
    keywords: ["sốt", "mệt", "ớn lạnh", "đau nhức", "chán ăn"],
  },
];

const MEDICAL_SPECIALTY_CODES = new Set([
  "GENERAL_MEDICINE",
  "CARDIOLOGY",
  "RESPIRATORY",
  "PEDIATRICS",
  "DERMATOLOGY",
  "NEUROLOGY",
  "ENT",
  "OB_GYN",
  "ORTHOPEDICS",
  "OPHTHALMOLOGY",
  "GASTROENTEROLOGY",
  "DENTISTRY",
  "UROLOGY",
  "ENDOCRINOLOGY",
  "PSYCHIATRY",
  "ONCOLOGY",
  "EMERGENCY",
]);

const CONVERSATION_INTENTS = new Set(["GREETING", "THANKS", "GOODBYE"]);

const ADMINISTRATIVE_MATCH_LABELS = {
  SAME_STREET: "Cùng số nhà/tên đường",
  SAME_WARD: "Cùng phường/xã",
  SAME_DISTRICT: "Cùng quận/huyện",
  SAME_CITY: "Cùng tỉnh/thành phố",
  DIFFERENT_AREA: "Khác khu vực",
} as const;

interface AdministrativeLocation {
  streetAddress: string | null;
  provinceCode: number | null;
  districtCode: number | null;
  wardCode: number | null;
}

interface DoctorDistance {
  distanceText: string | null;
  distanceMeters: number | null;
  durationText: string | null;
  durationSeconds: number | null;
  locationScore: number;
}

interface PreparedChatResponse {
  analysis: ModelAnalyzeResponse;
  hasEmergencySpecialty: boolean;
  recommendedSpecialtiesWithDoctors: RecommendedSpecialtyWithDoctors[];
  assistantContent: string;
  primarySpecialty: RecommendedSpecialtyWithDoctors | undefined;
}

interface RepeatedQuestionContext {
  analysis: ModelAnalyzeResponse;
  assistantContent: string;
}

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /*
  Gửi một cho server một đoạn tin nhắn
  */
  async sendMessage(userId: number, dto: SendChatMessageDto) {
    const content = dto.message.trim();
    if (!content) {
      throw new BadRequestException("Nội dung tin nhắn không được để trống");
    }

    const session = await this.resolveSession(userId, dto.sessionId, content);
    const repeatedQuestion = await this.findRepeatedQuestion(
      session.id,
      content,
    );
    const userMessage = await this.prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        userId,
        role: ChatRole.USER,
        content,
      },
    });

    const prepared = await this.prepareChatResponse(
      content,
      userId,
      repeatedQuestion?.analysis,
      repeatedQuestion?.assistantContent,
      Boolean(repeatedQuestion),
    );
    const {
      analysis,
      hasEmergencySpecialty,
      recommendedSpecialtiesWithDoctors,
      assistantContent,
      primarySpecialty,
    } = prepared;
    const responseAnalysis: ModelAnalyzeResponse = {
      ...analysis,
      repeatDetected: Boolean(repeatedQuestion),
    };

    const assistantMessage = await this.prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: ChatRole.ASSISTANT,
        content: assistantContent,
        metadata: responseAnalysis as unknown as Prisma.InputJsonValue,
      },
    });

    await this.prisma.chatSession.update({
      where: {
        id: session.id,
      },
      data: {
        updatedAt: new Date(),
      },
    });

    await this.prisma.consultationHistory.create({
      data: {
        userId,
        chatSessionId: session.id,
        userMessageId: userMessage.id,
        originalMessage: content,
        extractedSymptoms:
          responseAnalysis.symptoms as unknown as Prisma.InputJsonValue,
        recommendedSpecialtyId: primarySpecialty?.id,
        emergency: hasEmergencySpecialty,
        emergencyLevel: hasEmergencySpecialty ? "EMERGENCY" : "NORMAL",
        emergencyReasons: hasEmergencySpecialty
          ? (responseAnalysis.symptoms as unknown as Prisma.InputJsonValue)
          : undefined,
      },
    });

    return {
      session: {
        id: session.id,
        title: session.title,
      },
      userMessage,
      assistantMessage,
      analysis: {
        ...responseAnalysis,
        recommendedSpecialty: primarySpecialty ?? null,
        recommendedSpecialties: recommendedSpecialtiesWithDoctors,
      },
    };
  }

  /*
  Lấy danh sách message của một phiên chat.
  */
  async sendGuestMessage(dto: SendChatMessageDto) {
    const content = dto.message.trim();
    if (!content) {
      throw new BadRequestException("Ná»™i dung tin nháº¯n khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng");
    }

    const prepared = await this.prepareChatResponse(content);
    const {
      analysis,
      hasEmergencySpecialty,
      recommendedSpecialtiesWithDoctors,
      assistantContent,
      primarySpecialty,
    } = prepared;

    // Guest requests are intentionally logged without creating a chat session
    // or chat messages. The nullable fields identify this as a guest request.
    await this.prisma.consultationHistory.create({
      data: {
        originalMessage: content,
        extractedSymptoms:
          analysis.symptoms as unknown as Prisma.InputJsonValue,
        recommendedSpecialtyId: primarySpecialty?.id,
        emergency: hasEmergencySpecialty,
        emergencyLevel: hasEmergencySpecialty ? "EMERGENCY" : "NORMAL",
        emergencyReasons: hasEmergencySpecialty
          ? (analysis.symptoms as unknown as Prisma.InputJsonValue)
          : undefined,
      },
    });

    const createdAt = new Date().toISOString();
    const userMessage = {
      id: -Date.now(),
      sessionId: 0,
      userId: null,
      role: ChatRole.USER,
      content,
      metadata: null,
      createdAt,
    };
    const assistantMessage = {
      id: -(Date.now() + 1),
      sessionId: 0,
      userId: null,
      role: ChatRole.ASSISTANT,
      content: assistantContent,
      metadata: analysis as unknown as Prisma.JsonValue,
      createdAt,
    };

    return {
      session: null,
      userMessage,
      assistantMessage,
      analysis: {
        ...analysis,
        recommendedSpecialty: primarySpecialty ?? null,
        recommendedSpecialties: recommendedSpecialtiesWithDoctors,
      },
    };
  }

  private async prepareChatResponse(
    content: string,
    userId?: number,
    cachedAnalysis?: ModelAnalyzeResponse,
    cachedAssistantContent?: string,
    isRepeatedQuestion = false,
  ): Promise<PreparedChatResponse> {
    const analysis = cachedAnalysis ?? (await this.analyze(content));
    const isMedicalRequest = analysis.action === "FIND_DOCTORS";
    const hasEmergencySpecialty =
      isMedicalRequest && this.hasEmergencySpecialty(analysis);
    const recommendedSpecialties = isMedicalRequest
      ? await this.findRecommendedSpecialties(analysis)
      : [];
    const recommendedSpecialtiesWithDoctors = !isMedicalRequest
      ? []
      : hasEmergencySpecialty
        ? this.withoutDoctorSuggestions(recommendedSpecialties)
        : isRepeatedQuestion
          ? this.withoutDoctorSuggestions(recommendedSpecialties)
        : await this.attachDoctorsToSpecialties(
            userId,
            recommendedSpecialties,
            analysis,
          );
    const assistantContent =
      isRepeatedQuestion && cachedAssistantContent
        ? cachedAssistantContent
        : this.buildAssistantReply(analysis, recommendedSpecialtiesWithDoctors);
    const [primarySpecialty] = recommendedSpecialtiesWithDoctors;

    return {
      analysis,
      hasEmergencySpecialty,
      recommendedSpecialtiesWithDoctors,
      assistantContent,
      primarySpecialty,
    };
  }

  async testModel(content: string) {
    const message = content.trim();
    if (!message) {
      throw new BadRequestException("Nội dung kiểm tra không được để trống");
    }

    return this.analyze(message);
  }

  async listSessions(userId: number) {
    return this.prisma.chatSession.findMany({
      where: {
        userId,
      },
      select: {
        id: true,
        title: true,
        summary: true,
        createdAt: true,
        updatedAt: true,
        closedAt: true,
        _count: {
          select: {
            messages: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });
  }

  async listMessages(userId: number, sessionId: number) {
    const session = await this.prisma.chatSession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
    });

    if (!session) {
      throw new ForbiddenException("Bạn không có quyền xem phiên chat này");
    }

    return this.prisma.chatMessage.findMany({
      where: {
        sessionId,
      },
      orderBy: {
        createdAt: "asc",
      },
    });
  }

  /*
  Tìm kiếm đoạn tin nhắn hiện tại thuộc Session nào:
    - Nếu chưa có Session thì tạo một phiên chat mới lấy 80 kí tự đầu tiên làm title.
    - Nếu đã có tồn tại thì tiếp tục phiên chat.
  */
  private async resolveSession(
    userId: number,
    sessionId: number | undefined,
    firstMessage: string,
  ) {
    if (!sessionId) {
      return this.prisma.chatSession.create({
        data: {
          userId,
          title: firstMessage.slice(0, 80),
        },
      });
    }

    const session = await this.prisma.chatSession.findFirst({
      where: {
        id: sessionId,
        userId,
        closedAt: null,
      },
    });

    if (!session) {
      throw new ForbiddenException("Phiên chat không tồn tại hoặc đã đóng");
    }

    return session;
  }

  private async findRepeatedQuestion(
    sessionId: number,
    content: string,
  ): Promise<RepeatedQuestionContext | null> {
    const normalizedContent = this.normalizeRepeatedMessage(content);
    if (!normalizedContent) {
      return null;
    }

    const recentUserMessages = await this.prisma.chatMessage.findMany({
      where: {
        sessionId,
        role: ChatRole.USER,
      },
      select: {
        id: true,
        content: true,
      },
      orderBy: {
        id: "desc",
      },
      take: 6,
    });
    const previousMessage = recentUserMessages.find(
      (message) =>
        this.normalizeRepeatedMessage(message.content) === normalizedContent,
    );

    if (!previousMessage) {
      return null;
    }

    const previousAssistantMessage =
      await this.prisma.chatMessage.findFirst({
        where: {
          sessionId,
          role: ChatRole.ASSISTANT,
          id: {
            gt: previousMessage.id,
          },
        },
        select: {
          metadata: true,
          content: true,
        },
        orderBy: {
          id: "asc",
        },
      });

    if (!previousAssistantMessage?.metadata) {
      return null;
    }

    try {
      const rawMetadata = previousAssistantMessage.metadata as {
        analysisSource?: unknown;
      };
      const analysis = this.normalizeModelAnalysis(
        previousAssistantMessage.metadata,
      );
      const analysisSource =
        rawMetadata.analysisSource === "NER" ||
        rawMetadata.analysisSource === "Gemini"
          ? rawMetadata.analysisSource
          : undefined;

      return {
        analysis: {
          ...analysis,
          ...(analysisSource ? { analysisSource } : {}),
        },
        assistantContent: previousAssistantMessage.content,
      };
    } catch {
      return null;
    }
  }

  /*
  Gọi đến model NER
  */
  private async analyze(content: string): Promise<ModelAnalyzeResponse> {
    const modelUrl =
      this.config.get<string>("aiServiceUrl") ??
      this.config.get<string>("AI_SERVICE_URL") ??
      "http://localhost:5678";
    const endpoint = this.config.get<string>(
      "PYTHON_API_ENDPOINT",
      "/api/extract-symptoms",
    );
    const timeoutMs =
      this.config.get<number>("aiServiceTimeoutMs") ??
      Number(this.config.get<string>("AI_SERVICE_TIMEOUT_MS") ?? 60000);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(`${modelUrl}${endpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text: content }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new ServiceUnavailableException("Model chưa sẵn sàng");
        }
        const nerAnalysis: ModelAnalyzeResponse = {
          ...this.normalizeModelAnalysis(await response.json()),
          analysisSource: "NER",
        };

        if (nerAnalysis.action !== "FIND_DOCTORS") {
          return nerAnalysis;
        }

        if (!this.hasConfidentSymptoms(nerAnalysis)) {
          return this.analyzeWithGemini(content);
        }

        return nerAnalysis;
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      console.error("Không gọi được model NER, chuyển sang Gemini:", error);
      return this.analyzeWithGemini(content);
    }
  }

  private async analyzeWithGemini(
    content: string,
  ): Promise<ModelAnalyzeResponse> {
    const apiKey =
      this.config.get<string>("geminiApiKey") ??
      this.config.get<string>("GEMINI_API_KEY");
    const model =
      this.config.get<string>("geminiModel") ??
      this.config.get<string>("GEMINI_MODEL") ??
      "gemini-1.5-flash";

    if (!apiKey) {
      throw new ServiceUnavailableException("Gemini API key chưa được cấu hình");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: this.buildGeminiAnalyzePrompt(content),
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0,
              responseMimeType: "application/json",
            },
          }),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        throw new ServiceUnavailableException("Gemini chưa sẵn sàng");
      }

      const payload = (await response.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
          };
        }>;
      };
      const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        throw new ServiceUnavailableException("Gemini không trả về JSON");
      }

      const analysis = this.normalizeGeminiAnalysis(JSON.parse(text));
      return analysis;
    } finally {
      clearTimeout(timeout);
    }
  }

  private normalizeModelAnalysis(value: unknown): ModelAnalyzeResponse {
    if (!value || typeof value !== "object") {
      throw new ServiceUnavailableException("Model trả về JSON không hợp lệ");
    }

    const raw = value as {
      symptoms?: unknown;
      specialties?: unknown;
      intent?: unknown;
      action?: unknown;
    };
    const rawIntent =
      typeof raw.intent === "string" ? raw.intent.toUpperCase() : "UNKNOWN";
    const rawAction =
      typeof raw.action === "string" ? raw.action.toUpperCase() : "CLARIFY";
    const intent = [
      "SYMPTOM",
      "GREETING",
      "THANKS",
      "GOODBYE",
      "UNKNOWN",
    ].includes(rawIntent)
      ? (rawIntent as ModelAnalyzeResponse["intent"])
      : "UNKNOWN";

    const symptoms = Array.isArray(raw.symptoms)
      ? raw.symptoms
          .map((symptom) => {
            if (!symptom || typeof symptom !== "object") {
              return null;
            }

            const item = symptom as {
              name?: unknown;
              confidence?: unknown;
              specialty_code?: unknown;
            };
            const specialtyCode =
              typeof item.specialty_code === "string"
                ? item.specialty_code.toUpperCase()
                : "";
            const confidence = Number(item.confidence);

            if (
              typeof item.name !== "string" ||
              !MEDICAL_SPECIALTY_CODES.has(specialtyCode) ||
              !Number.isFinite(confidence)
            ) {
              return null;
            }

            return {
              name: item.name.trim(),
              confidence: this.clampScore(confidence),
              specialty_code: specialtyCode,
            };
          })
          .filter((symptom): symptom is ModelSymptom => Boolean(symptom))
      : [];

    if (symptoms.length > 0) {
      return {
        symptoms,
        specialties: [
          ...new Set(symptoms.map((symptom) => symptom.specialty_code)),
        ],
        intent: "SYMPTOM",
        action: "FIND_DOCTORS",
      };
    }

    if (rawAction === "REPLY" && CONVERSATION_INTENTS.has(intent)) {
      return {
        symptoms: [],
        specialties: [intent],
        intent,
        action: "REPLY",
      };
    }

    return {
      symptoms: [],
      specialties: [],
      intent: "UNKNOWN",
      action: "CLARIFY",
    };
  }

  private hasConfidentSymptoms(analysis: ModelAnalyzeResponse) {
    return (
      analysis.symptoms.some((symptom) => symptom.confidence >= 0.5) &&
      analysis.specialties.length > 0
    );
  }

  private buildGeminiAnalyzePrompt(content: string) {
    return `Bạn là bộ trích xuất triệu chứng y tế cho hệ thống gợi ý chuyên khoa.

Yêu cầu bắt buộc:
- Chỉ trích xuất triệu chứng được người dùng nêu rõ trong câu.
- Không suy luận bệnh.
- Không tự thêm triệu chứng không xuất hiện trong câu.
- Không đưa lời khuyên y tế.
- Nếu là lời chào, cảm ơn hoặc tạm biệt thuần túy, nhận diện intent tương ứng
  (GREETING, THANKS, GOODBYE) và action là REPLY.
- Nếu câu có triệu chứng y tế, luôn ưu tiên intent SYMPTOM và action FIND_DOCTORS.
- Chỉ trả về JSON hợp lệ, không markdown, không giải thích.
- specialty_code chỉ được dùng một trong các mã sau:
GENERAL_MEDICINE, CARDIOLOGY, RESPIRATORY, PEDIATRICS, DERMATOLOGY, NEUROLOGY, ENT, OB_GYN, ORTHOPEDICS, OPHTHALMOLOGY, GASTROENTEROLOGY, DENTISTRY, UROLOGY, ENDOCRINOLOGY, PSYCHIATRY, ONCOLOGY, EMERGENCY.

Format JSON bắt buộc:
{
  "symptoms": [
    {
      "name": "string",
      "confidence": 0.0,
      "specialty_code": "SPECIALTY_CODE"
    }
  ],
  "specialties": ["SPECIALTY_CODE"],
  "intent": "SYMPTOM",
  "action": "FIND_DOCTORS"
}

Với lời chào/cảm ơn/tạm biệt thuần túy, dùng format:
{
  "symptoms": [],
  "specialties": ["GREETING"],
  "intent": "GREETING",
  "action": "REPLY"
}

Nếu không có triệu chứng rõ ràng, trả về:
{
  "symptoms": [],
  "specialties": [],
  "intent": "UNKNOWN",
  "action": "CLARIFY"
}

Câu người dùng:
${content}`;
  }

  private normalizeGeminiAnalysis(value: unknown): ModelAnalyzeResponse {
    return {
      ...this.normalizeModelAnalysis(value),
      analysisSource: "Gemini",
    };
  }

  /*
  So triệu chứng với database.
  */
  private async findRecommendedSpecialties(
    analysis: ModelAnalyzeResponse,
  ): Promise<RecommendedSpecialty[]> {
    if (!analysis.specialties.length) {
      return [];
    }

    const specialties = await this.prisma.specialty.findMany({
      where: {
        code: {
          in: analysis.specialties,
        },
      },
      select: {
        id: true,
        code: true,
        name: true,
      },
    });

    return analysis.specialties
      .map((code) => {
        const specialty = specialties.find((item) => item.code === code);
        if (specialty) {
          return specialty;
        }

        const fallback = SPECIALTY_HINTS.find((hint) => hint.code === code);
        return fallback
          ? {
              id: null,
              code: fallback.code,
              name: fallback.name,
            }
          : null;
      })
      .filter((item): item is RecommendedSpecialty => item !== null);
  }

  private hasEmergencySpecialty(analysis: ModelAnalyzeResponse) {
    return (
      analysis.specialties.includes("EMERGENCY") ||
      analysis.symptoms.some(
        (symptom) => symptom.specialty_code === "EMERGENCY",
      )
    );
  }

  private withoutDoctorSuggestions(
    specialties: RecommendedSpecialty[],
  ): RecommendedSpecialtyWithDoctors[] {
    return specialties.map((specialty) => ({
      ...specialty,
      doctors: [],
    }));
  }

  /*
  Map chuyên khoa để lấy các bác sĩ tương ứng mà người nhập triệu chứng vào.
  */
  private async attachDoctorsToSpecialties(
    userId: number | undefined,
    specialties: RecommendedSpecialty[],
    analysis: ModelAnalyzeResponse,
  ): Promise<RecommendedSpecialtyWithDoctors[]> {
    if (!specialties.length) {
      return [];
    }

    const doctors = await this.prisma.doctor.findMany({
      where: {
        status: "ACTIVE",
        specialty: {
          code: {
            in: specialties.map((specialty) => specialty.code),
          },
        },
      },
      select: {
        id: true,
        fullName: true,
        academicTitle: true,
        experienceYears: true,
        workplace: true,
        streetAddress: true,
        address: true,
        city: true,
        provinceCode: true,
        districtCode: true,
        wardCode: true,
        phoneNumber: true,
        email: true,
        workingTime: true,
        consultationType: true,
        rating: true,
        specialty: {
          select: {
            code: true,
          },
        },
        expertises: {
          select: {
            expertiseScore: true,
            symptom: {
              select: {
                name: true,
                normalizedName: true,
              },
            },
          },
        },
      },
      orderBy: [
        {
          rating: "desc",
        },
        {
          experienceYears: "desc",
        },
      ],
    });
    const userLocation = await this.findUserLocation(userId);
    const doctorDistances = await this.findDoctorDistances(
      userLocation,
      doctors,
    );

    return specialties.map((specialty) => ({
      ...specialty,
      doctors: doctors
        .filter((doctor) => doctor.specialty.code === specialty.code)
        .map((doctor): RecommendedDoctor => {
          const distance = doctorDistances.get(doctor.id);
          const specialtyScore = 1;
          const expertiseScore = this.calculateExpertiseScore(
            doctor.expertises,
            analysis,
            specialty.code,
          );
          const experienceScore = this.calculateExperienceScore(
            doctor.experienceYears,
          );
          const locationScore = distance?.locationScore ?? 0;
          const ratingScore = this.calculateRatingScore(
            doctor.rating?.toString() ?? null,
          );
          const doctorScore = this.calculateDoctorScore({
            specialtyScore,
            expertiseScore,
            experienceScore,
            locationScore,
            ratingScore,
          });

          return {
            id: doctor.id,
            fullName: doctor.fullName,
            academicTitle: doctor.academicTitle,
            experienceYears: doctor.experienceYears,
            workplace: doctor.workplace,
            streetAddress: doctor.streetAddress,
            address: doctor.address,
            city: doctor.city,
            provinceCode: doctor.provinceCode,
            districtCode: doctor.districtCode,
            wardCode: doctor.wardCode,
            phoneNumber: doctor.phoneNumber,
            email: doctor.email,
            workingTime: doctor.workingTime,
            consultationType: doctor.consultationType,
            rating: doctor.rating?.toString() ?? null,
            distanceText: distance?.distanceText ?? null,
            distanceMeters: distance?.distanceMeters ?? null,
            durationText: distance?.durationText ?? null,
            durationSeconds: distance?.durationSeconds ?? null,
            specialtyScore,
            expertiseScore,
            experienceScore,
            locationScore: distance?.locationScore ?? null,
            ratingScore,
            doctorScore,
          };
        })
        .sort((firstDoctor, secondDoctor) => {
          if (firstDoctor.doctorScore !== secondDoctor.doctorScore) {
            return secondDoctor.doctorScore - firstDoctor.doctorScore;
          }

          const firstScore = firstDoctor.locationScore ?? 0;
          const secondScore = secondDoctor.locationScore ?? 0;

          if (firstScore !== secondScore) {
            return secondScore - firstScore;
          }

          if (firstDoctor.rating !== secondDoctor.rating) {
            return (
              Number(secondDoctor.rating ?? 0) - Number(firstDoctor.rating ?? 0)
            );
          }

          if (firstDoctor.experienceYears !== secondDoctor.experienceYears) {
            return secondDoctor.experienceYears - firstDoctor.experienceYears;
          }

          if (
            firstDoctor.distanceMeters === null &&
            secondDoctor.distanceMeters === null
          ) {
            return 0;
          }

          if (firstDoctor.distanceMeters === null) {
            return 1;
          }

          if (secondDoctor.distanceMeters === null) {
            return -1;
          }

          return firstDoctor.distanceMeters - secondDoctor.distanceMeters;
        }),
    }));
  }

  private async findUserLocation(userId: number | undefined) {
    if (!userId) {
      return null;
    }

    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        provinceCode: true,
        districtCode: true,
        wardCode: true,
        streetAddress: true,
      },
    });

    if (!user) {
      return null;
    }

    return {
      provinceCode: user.provinceCode,
      districtCode: user.districtCode,
      wardCode: user.wardCode,
      streetAddress: user.streetAddress,
    };
  }

  private calculateExpertiseScore(
    expertises: Array<{
      expertiseScore: { toString(): string };
      symptom: {
        name: string;
        normalizedName: string;
      };
    }>,
    analysis: ModelAnalyzeResponse,
    specialtyCode: string,
  ) {
    const symptomNames = analysis.symptoms
      .filter((symptom) => symptom.specialty_code === specialtyCode)
      .map((symptom) => this.normalize(symptom.name));

    if (!symptomNames.length) {
      return 0;
    }

    const matchedExpertiseScores = expertises
      .filter((expertise) => {
        const normalizedName = this.normalize(expertise.symptom.name);
        const normalizedCode = this.normalize(expertise.symptom.normalizedName);

        return symptomNames.some(
          (symptomName) =>
            symptomName === normalizedName || symptomName === normalizedCode,
        );
      })
      .map((expertise) => Number(expertise.expertiseScore.toString()))
      .filter((score) => Number.isFinite(score));

    if (!matchedExpertiseScores.length) {
      return 0;
    }

    const total = matchedExpertiseScores.reduce((sum, score) => sum + score, 0);
    return this.clampScore(total / matchedExpertiseScores.length);
  }

  private calculateExperienceScore(experienceYears: number) {
    return this.clampScore(Math.min(Math.max(experienceYears, 0), 10) / 10);
  }

  private calculateRatingScore(rating: string | null) {
    return this.clampScore(Number(rating ?? 0) / 5);
  }

  /*
  Tính điểm cho từng bác sĩ
  */
  private calculateDoctorScore(scores: {
    specialtyScore: number;
    expertiseScore: number;
    experienceScore: number;
    locationScore: number;
    ratingScore: number;
  }) {
    return this.clampScore(
      scores.specialtyScore * 0.25 +
        scores.expertiseScore * 0.25 +
        scores.experienceScore * 0.15 +
        scores.locationScore * 0.3 +
        scores.ratingScore * 0.05,
    );
  }

  private clampScore(score: number) {
    if (!Number.isFinite(score)) {
      return 0;
    }

    return Math.min(Math.max(score, 0), 1);
  }

  private async findDoctorDistances(
    userLocation: AdministrativeLocation | null,
    doctors: Array<{
      id: number;
      streetAddress: string | null;
      address: string | null;
      city: string | null;
      provinceCode: number | null;
      districtCode: number | null;
      wardCode: number | null;
    }>,
  ) {
    const result = new Map<number, DoctorDistance>();
    if (!userLocation) {
      return result;
    }

    for (const doctor of doctors) {
      result.set(
        doctor.id,
        this.calculateAdministrativeDistance(userLocation, {
          streetAddress: doctor.streetAddress,
          provinceCode: doctor.provinceCode,
          districtCode: doctor.districtCode,
          wardCode: doctor.wardCode,
        }),
      );
    }

    return result;
  }

  private calculateAdministrativeDistance(
    userLocation: AdministrativeLocation,
    doctorLocation: AdministrativeLocation,
  ): DoctorDistance {
    const sameProvince = Boolean(
      userLocation.provinceCode &&
      doctorLocation.provinceCode &&
      userLocation.provinceCode === doctorLocation.provinceCode,
    );
    const sameDistrict = Boolean(
      sameProvince &&
      userLocation.districtCode &&
      doctorLocation.districtCode &&
      userLocation.districtCode === doctorLocation.districtCode,
    );
    const sameWard = Boolean(
      sameDistrict &&
      userLocation.wardCode &&
      doctorLocation.wardCode &&
      userLocation.wardCode === doctorLocation.wardCode,
    );

    if (
      sameWard &&
      this.isSameStreetAddress(
        userLocation.streetAddress,
        doctorLocation.streetAddress,
      )
    ) {
      return this.buildAdministrativeDistance(
        ADMINISTRATIVE_MATCH_LABELS.SAME_STREET,
        1,
      );
    }

    if (sameWard) {
      return this.buildAdministrativeDistance(
        ADMINISTRATIVE_MATCH_LABELS.SAME_WARD,
        0.65,
      );
    }

    if (sameDistrict) {
      return this.buildAdministrativeDistance(
        ADMINISTRATIVE_MATCH_LABELS.SAME_DISTRICT,
        0.4,
      );
    }

    if (sameProvince) {
      return this.buildAdministrativeDistance(
        ADMINISTRATIVE_MATCH_LABELS.SAME_CITY,
        0.2,
      );
    }

    return this.buildAdministrativeDistance(
      ADMINISTRATIVE_MATCH_LABELS.DIFFERENT_AREA,
      0,
    );
  }

  private buildAdministrativeDistance(label: string, locationScore: number) {
    return {
      distanceText: label,
      distanceMeters: null,
      durationText: null,
      durationSeconds: null,
      locationScore,
    };
  }

  private isSameStreetAddress(
    firstAddress: string | null,
    secondAddress: string | null,
  ) {
    const first = this.normalizeStreetAddress(firstAddress);
    const second = this.normalizeStreetAddress(secondAddress);

    return Boolean(first && second && first === second);
  }

  private normalizeStreetAddress(address: string | null) {
    if (!address) {
      return "";
    }

    return this.normalize(address)
      .replace(/\bso\b/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  private formatScorePercent(score: number) {
    return Math.round(this.clampScore(score) * 100);
  }

  private getSuitabilityLabel(score: number) {
    const percent = this.formatScorePercent(score);

    if (percent >= 85) {
      return "Rất phù hợp";
    }

    if (percent >= 70) {
      return "Phù hợp";
    }

    if (percent >= 50) {
      return "Có thể tham khảo";
    }

    return "Ít phù hợp";
  }

  private formatWorkSchedule(workingTime: string | null) {
    if (!workingTime) {
      return "chưa cập nhật";
    }

    return workingTime
      .replace(/Mon-Fri/g, "Thứ Hai – Thứ Sáu")
      .replace(/Mon-Sat/g, "Thứ Hai – Thứ Bảy")
      .replace(/Mon-Sun/g, "Thứ Hai – Chủ Nhật")
      .replace(/Tue-Sat/g, "Thứ Ba – Thứ Bảy");
  }

  private buildRecommendationReason(doctor: RecommendedDoctor) {
    const reasons = ["đúng chuyên khoa"];

    if (doctor.expertiseScore >= 0.8) {
      reasons.push("khớp tốt với triệu chứng");
    }

    if (doctor.experienceScore >= 1) {
      reasons.push("nhiều kinh nghiệm");
    }

    if ((doctor.locationScore ?? 0) >= 0.65) {
      reasons.push("làm việc gần khu vực của bạn");
    }

    if (doctor.ratingScore >= 0.9) {
      reasons.push("đánh giá cao");
    }

    return `Bác sĩ được đề xuất vì ${reasons.join(", ")}.`;
  }

  private buildAnalysisSourceLabel(analysis: ModelAnalyzeResponse) {
    return `Nguồn phân tích: ${analysis.analysisSource ?? "NER"}`;
  }

  /*
  Nhóm các triệu chứng cùng chuyên khoa lại với nhau
  */
  private buildAssistantReply(
    analysis: ModelAnalyzeResponse,
    recommendedSpecialties: RecommendedSpecialtyWithDoctors[],
  ) {
    if (recommendedSpecialties.length) {
      const groupedSymptoms = recommendedSpecialties.map((specialty) => {
        const symptoms = analysis.symptoms
          .filter((item) => item.specialty_code === specialty.code)
          .map((item) => item.name);
        const symptomText = symptoms.length
          ? [...new Set(symptoms)].join(", ")
          : "cần mô tả thêm triệu chứng";

        return `o   ${specialty.name}: ${symptomText}`;
      });

      if (
        recommendedSpecialties.some(
          (specialty) => specialty.code === "EMERGENCY",
        )
      ) {
        return `Mình ghi nhận có dấu hiệu thuộc nhóm cấp cứu:\n\n${groupedSymptoms.join(
          "\n",
        )}\n\nVới các triệu chứng cấp cứu, bạn không nên chờ gợi ý bác sĩ trên hệ thống. Hãy đến cơ sở y tế gần nhất hoặc gọi cấp cứu để được thăm khám và điều trị kịp thời.\n\nThông tin này chỉ mang tính tham khảo, không thay thế chẩn đoán của bác sĩ.\n${this.buildAnalysisSourceLabel(analysis)}`;
      }

      const doctorSuggestions = recommendedSpecialties.map((specialty) => {
        if (!specialty.doctors.length) {
          return `Chuyên khoa: ${specialty.name}\nChưa có bác sĩ phù hợp trong hệ thống.`;
        }

        const doctors = specialty.doctors
          .slice(0, 5)
          .map((doctor, index) => {
            const title = doctor.academicTitle
              ? `${doctor.academicTitle} ${doctor.fullName}`
              : doctor.fullName;
            const consultationType = doctor.consultationType.length
              ? doctor.consultationType
                  .map((type) =>
                    type === "ONLINE" ? "Tư vấn online" : "Khám trực tiếp",
                  )
                  .join(", ")
              : "chưa cập nhật";
            const distance = doctor.distanceText
              ? `\n• Khoảng cách khu vực: ${doctor.distanceText}`
              : "";
            const scorePercent = this.formatScorePercent(doctor.doctorScore);
            const suitabilityLabel = this.getSuitabilityLabel(
              doctor.doctorScore,
            );
            const workSchedule = this.formatWorkSchedule(doctor.workingTime);
            const recommendationReason =
              this.buildRecommendationReason(doctor);

            return `${index + 1}. ${title}\n\nĐiểm phù hợp: ${scorePercent}% — ${suitabilityLabel}\n\n• Chuyên khoa: ${specialty.name}\n• Kinh nghiệm: ${doctor.experienceYears} năm\n• Đánh giá: ${doctor.rating ?? "chưa cập nhật"}/5\n• Nơi làm việc: ${doctor.workplace ?? "chưa cập nhật"}\n• Địa chỉ: ${doctor.address ?? doctor.city ?? "chưa cập nhật"}${distance}\n• Thời gian làm việc: ${workSchedule}\n• Hình thức tư vấn: ${consultationType}\n• Điện thoại: ${doctor.phoneNumber ?? "chưa cập nhật"}\n• Email: ${doctor.email ?? "chưa cập nhật"}\n\nLý do đề xuất: ${recommendationReason}`;
          })
          .join("\n\n");

        return `Chuyên khoa: ${specialty.name}\n\n${doctors}`;
      });

      return `Kết quả tham khảo\n\nDựa trên triệu chứng bạn cung cấp:\n\n${groupedSymptoms.join(
        "\n",
      )}\n\nDưới đây là các bác sĩ có mức độ phù hợp cao nhất.\n\n${doctorSuggestions.join(
        "\n\n",
      )}\n\nThông tin này chỉ mang tính tham khảo, không thay thế chẩn đoán của bác sĩ.\n${this.buildAnalysisSourceLabel(analysis)}`;
    }

    if (analysis.action === "REPLY") {
      return this.buildConversationReply(analysis.intent);
    }

    return this.buildClarificationReply();
  }

  private buildConversationReply(intent: ModelAnalyzeResponse["intent"]) {
    switch (intent) {
      case "GREETING":
        return "Xin chào! Tôi có thể hỗ trợ bạn tìm chuyên khoa dựa trên triệu chứng. Bạn đang gặp vấn đề sức khỏe nào?";
      case "THANKS":
        return "Không có gì. Tôi rất vui được hỗ trợ bạn!";
      case "GOODBYE":
        return "Tạm biệt! Chúc bạn nhiều sức khỏe.";
      default:
        return this.buildClarificationReply();
    }
  }

  private buildClarificationReply() {
    return 'Tôi chưa nhận diện được triệu chứng rõ ràng. Bạn hãy mô tả cụ thể hơn, ví dụ: "Tôi bị đau đầu và sốt cao".';
  }

  private normalize(value: string) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase();
  }

  private normalizeRepeatedMessage(value: string) {
    return this.normalize(value)
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  }
}
