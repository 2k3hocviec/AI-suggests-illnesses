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
  ClinicalField,
  ClinicalSlot,
  ClinicalSlots,
  ModelAnalyzeResponse,
  ModelRedFlag,
  ModelSymptom,
  ChatHistoryMessage,
  LocalReasoningResponse,
  RecommendedDoctor,
  RecommendedSpecialty,
  RecommendedSpecialtyWithDoctors,
  SpecialtyHint,
} from "./chat.types";

var count = 0;
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
  SAME_STREET: "Cùng đường/tổ dân phố",
  SAME_COMMUNE: "Cùng xã/phường",
  SAME_PROVINCE: "Cùng tỉnh/thành",
  DIFFERENT_AREA: "Khác khu vực",
} as const;

interface AdministrativeLocation {
  streetAddress: string | null;
  provinceCode: number | null;
  communeCode: number | null;
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
  private readonly guestAnalyses = new Map<string, ModelAnalyzeResponse>();
  private readonly guestHistories = new Map<string, ChatHistoryMessage[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) { }

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
    const previousAnalysis = await this.findLatestSessionAnalysis(session.id);
    const userMessage = await this.prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        userId,
        role: ChatRole.USER,
        content,
      },
    });
    const history = await this.getChatHistory(session.id);

    const prepared = await this.prepareChatResponse(
      content,
      userId,
      repeatedQuestion?.analysis,
      repeatedQuestion?.assistantContent,
      Boolean(repeatedQuestion),
      previousAnalysis,
      history,
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
        metadata: {
          ...responseAnalysis,
          recommendedSpecialties: recommendedSpecialtiesWithDoctors,
        } as unknown as Prisma.InputJsonValue,
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
      throw new BadRequestException("Nội dung tin nhắn không được để trống");
    }

    const previousAnalysis = dto.guestSessionId
      ? this.guestAnalyses.get(dto.guestSessionId)
      : undefined;
    const previousHistory = dto.guestSessionId
      ? (this.guestHistories.get(dto.guestSessionId) ?? [])
      : [];
    const prepared = await this.prepareChatResponse(
      content,
      undefined,
      undefined,
      undefined,
      false,
      previousAnalysis,
      previousHistory,
    );
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
      metadata: {
        ...analysis,
        recommendedSpecialties: recommendedSpecialtiesWithDoctors,
      } as unknown as Prisma.JsonValue,
      createdAt,
    };

    if (dto.guestSessionId) {
      const nextHistory = [
        ...previousHistory,
        { role: "USER" as const, content },
        { role: "ASSISTANT" as const, content: assistantContent },
      ];
      if (analysis.readyForRecommendation) {
        this.guestAnalyses.delete(dto.guestSessionId);
        this.guestHistories.delete(dto.guestSessionId);
      } else {
        this.guestHistories.set(dto.guestSessionId, nextHistory);
        this.guestAnalyses.set(dto.guestSessionId, analysis);
      }
    }

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
    previousAnalysis?: ModelAnalyzeResponse,
    history: ChatHistoryMessage[] = [],
  ): Promise<PreparedChatResponse> {
    const rawAnalysis = cachedAnalysis
      ? cachedAnalysis
      : await this.analyzeConversation(content, history);
    let analysis = cachedAnalysis ? cachedAnalysis : rawAnalysis;

    // Nếu người dùng chào hỏi, cảm ơn, tạm biệt thì không bao giờ gợi ý bác sĩ
    // dù phân tích trước đó đã đủ trường.
    const isConversationalIntent =
      CONVERSATION_INTENTS.has(analysis.intent) ||
      (analysis.intent === "UNKNOWN" && analysis.symptoms.length === 0);

    const isMedicalRequest =
      !isConversationalIntent && analysis.readyForRecommendation;
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

  /*
  Lấy lích sử chat, lích sử phân tích để gửi cho model dialogue_policy
  */
  private async getChatHistory(
    sessionId: number,
  ): Promise<ChatHistoryMessage[]> {
    const messages = await this.prisma.chatMessage.findMany({
      where: { sessionId },
      select: { role: true, content: true },
      orderBy: { id: "asc" },
    });

    return messages.map((message) => ({
      role: message.role as ChatHistoryMessage["role"],
      content: message.content,
    }));
  }

  private async decideNextLocally(
    content: string,
    history: ChatHistoryMessage[],
    analysis: ModelAnalyzeResponse,
  ): Promise<LocalReasoningResponse | null> {
    const modelUrl = this.config.get<string>("aiReasonerUrl");
    const endpoint = this.config.get<string>(
      "aiReasonerEndpoint",
      "/api/decide-next",
    );
    const timeoutMs = this.config.get<number>("aiReasonerTimeoutMs") ?? 10000;

    if (!modelUrl || !endpoint) {
      return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const requestPayload = {
        message: content,
        history,
        analysis,
      };
      count++;
      console.log(count);
      console.log(
        "[Backend -> AI] /api/decide-next:",
        JSON.stringify(requestPayload, null, 2),
      );

      const response = await fetch(`${modelUrl}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload),
        signal: controller.signal,
      });

      if (!response.ok) {
        return null;
      }

      const payload = (await response.json()) as Record<string, unknown>;
      count++;
      console.log(count);
      console.log(
        "[AI -> Backend] /api/decide-next:",
        JSON.stringify(payload, null, 2),
      );
      const nextAction = payload.nextAction;
      const field = payload.field;
      const confidence = Number(payload.confidence);
      const source =
        payload.source === "RULE" || payload.source === "MODEL"
          ? payload.source
          : undefined;
      const rawQuestion =
        typeof payload.question === "string" ? payload.question.trim() : "";
      const question =
        rawQuestion.length <= 240 &&
          rawQuestion.includes("?") &&
          ![
            "chẩn đoán",
            "chan doan",
            "điều trị",
            "dieu tri",
            "uống thuốc",
            "uong thuoc",
            "kê đơn",
            "ke don",
            "diagnos",
            "treatment",
            "prescribe",
          ].some((phrase) => rawQuestion.toLowerCase().includes(phrase))
          ? rawQuestion
          : undefined;
      const validActions = new Set([
        "ASK_FOLLOW_UP",
        "FIND_DOCTORS",
        "EMERGENCY",
        "REPLY",
        "CLARIFY",
      ]);
      const validFields = new Set(["NONE", "duration", "severity", "age"]);

      if (
        typeof nextAction !== "string" ||
        !validActions.has(nextAction) ||
        typeof field !== "string" ||
        !validFields.has(field) ||
        !Number.isFinite(confidence)
      ) {
        return null;
      }

      return {
        nextAction: nextAction as LocalReasoningResponse["nextAction"],
        field: field as LocalReasoningResponse["field"],
        confidence: this.clampScore(confidence),
        ...(source ? { source } : {}),
        ...(question ? { question } : {}),
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private applyLocalReasoning(
    analysis: ModelAnalyzeResponse,
    decision: LocalReasoningResponse | null,
  ): ModelAnalyzeResponse {
    const minimumConfidence =
      this.config.get<number>("aiReasonerMinConfidence") ?? 0.25;
    if (!decision || decision.confidence < minimumConfidence) {
      return analysis;
    }

    // Trường hợp mà gặp triệu chứng EMERGENCY sẽ được xử lý luồng an toàn riêng trả về đi đến cơ sở y tế không gợi ý bác sĩ nữa
    if (analysis.redFlags.length > 0) {
      return analysis;
    }

    if (
      decision.nextAction === "ASK_FOLLOW_UP" &&
      decision.field !== "NONE" &&
      analysis.missingFields.includes(decision.field)
    ) {
      return {
        ...analysis,
        action: "CLARIFY",
        readyForRecommendation: false,
        followUpQuestion:
          decision.question ??
          this.buildClinicalFollowUpQuestion(decision.field),
      };
    }

    if (decision.nextAction === "REPLY" && analysis.symptoms.length === 0) {
      return {
        ...analysis,
        action: "REPLY",
        followUpQuestion: decision.question || null,
      };
    }

    // FIND_DOCTORS, EMERGENCY and CLARIFY cannot override the clinical
    // readiness and emergency decisions computed by the backend.
    return analysis;
  }

  async listSessions(userId: number) {
    return this.prisma.chatSession.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        summary: true,
        createdAt: true,
        updatedAt: true,
        closedAt: true,
        deletedAt: true,
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
        deletedAt: null,
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
  Đóng phiên chat theo yêu cầu.
  */
  async closeSession(userId: number, sessionId: number) {
    const session = await this.prisma.chatSession.findFirst({
      where: {
        id: sessionId,
        userId,
        deletedAt: null,
      },
    });

    if (!session) {
      throw new ForbiddenException(
        "Bạn không có quyền thao tác phiên chat này",
      );
    }

    if (session.closedAt) {
      return session;
    }

    return this.prisma.chatSession.update({
      where: { id: sessionId },
      data: { closedAt: new Date() },
    });
  }

  async deleteSession(userId: number, sessionId: number) {
    const session = await this.prisma.chatSession.findFirst({
      where: {
        id: sessionId,
        userId,
        deletedAt: null,
      },
    });

    if (!session) {
      throw new ForbiddenException(
        "Bạn không có quyền thao tác phiên chat này",
      );
    }

    const deletedAt = new Date();
    await this.prisma.chatSession.update({
      where: { id: sessionId },
      data: { deletedAt },
    });

    return { id: sessionId, deletedAt };
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
        deletedAt: null,
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
    });
    const previousMessage = recentUserMessages.find(
      (message) =>
        this.normalizeRepeatedMessage(message.content) === normalizedContent,
    );

    if (!previousMessage) {
      return null;
    }

    const previousAssistantMessage = await this.prisma.chatMessage.findFirst({
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

  private async findLatestSessionAnalysis(
    sessionId: number,
  ): Promise<ModelAnalyzeResponse | undefined> {
    const previousAssistantMessage = await this.prisma.chatMessage.findFirst({
      where: {
        sessionId,
        role: ChatRole.ASSISTANT,
        metadata: { not: Prisma.JsonNull },
      },
      select: { metadata: true },
      orderBy: { id: "desc" },
    });

    if (!previousAssistantMessage?.metadata) {
      return undefined;
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
        ...analysis,
        ...(analysisSource ? { analysisSource } : {}),
      };
    } catch {
      return undefined;
    }
  }

  /*
  Gọi đến model NER:
    - Có thể gọi đến GEMINI khi model chưa sẵn sàng.
    - Phát sinh bất cứ lỗi gì cũng sẽ gọi sang GEMINI.
  */
  private async analyzeConversation(
    content: string,
    history: ChatHistoryMessage[],
  ): Promise<ModelAnalyzeResponse> {
    const modelUrl =
      this.config.get<string>("aiServiceUrl") ??
      this.config.get<string>("AI_SERVICE_URL") ??
      "http://localhost:5678";
    const endpoint = this.config.get<string>(
      "PYTHON_POLICY_ENDPOINT",
      "/api/decide-next",
    );
    const timeoutMs =
      this.config.get<number>("aiServiceTimeoutMs") ??
      Number(this.config.get<string>("AI_SERVICE_TIMEOUT_MS") ?? 60000);
    const last = history[history.length - 1];
    const conversationHistory =
      last?.role === "USER" && last.content === content
        ? history
        : [...history, { role: "USER" as const, content }];
    const requestPayload = { history: conversationHistory };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      console.log(
        "[Backend -> AI] /api/decide-next:",
        JSON.stringify(requestPayload, null, 2),
      );
      const response = await fetch(`${modelUrl}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new ServiceUnavailableException(
          "Model conversation chÆ°a sáºµn sÃ ng",
        );
      }

      const payload = await response.json();
      console.log(
        "[AI -> Backend] /api/decide-next:",
        JSON.stringify(payload, null, 2),
      );
      return this.normalizeConversationAnalysis(payload);
    } finally {
      clearTimeout(timeout);
    }
  }

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
        const requestPayload = { text: content };
        count++;
        console.log(count);
        console.log(
          "[Backend -> AI] /api/extract-symptoms:",
          JSON.stringify(requestPayload),
        );

        const response = await fetch(`${modelUrl}${endpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestPayload),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new ServiceUnavailableException("Model chưa sẵn sàng");
        }
        const payload = await response.json();
        count++;
        console.log(count);
        console.log(
          "[AI -> Backend] /api/extract-symptoms:",
          JSON.stringify(payload, null, 2),
        );
        const nerAnalysis: ModelAnalyzeResponse = {
          ...this.normalizeModelAnalysis(payload),
          analysisSource: "NER",
        };

        if (nerAnalysis.action !== "FIND_DOCTORS") {
          return nerAnalysis;
        }

        if (!this.hasConfidentSymptoms(nerAnalysis)) {
          return this.isGeminiFallbackEnabled()
            ? this.analyzeWithGemini(content)
            : nerAnalysis;
        }

        return nerAnalysis;
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      console.error("Không gọi được model NER, chuyển sang Gemini:", error);
      if (!this.isGeminiFallbackEnabled()) {
        return this.buildUnknownAnalysis();
      }
      return this.analyzeWithGemini(content);
    }
  }

  private isGeminiFallbackEnabled() {
    return this.config.get<boolean>("enableGeminiFallback") ?? true;
  }

  private buildUnknownAnalysis(): ModelAnalyzeResponse {
    return this.withClinicalFollowUp({
      symptoms: [],
      specialties: [],
      intent: "UNKNOWN",
      action: "CLARIFY",
      slots: {
        duration: null,
        severity: null,
        age: null,
      },
      redFlags: [],
      missingFields: [],
      followUpQuestion: null,
      readyForRecommendation: false,
      analysisSource: "NER",
    });
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
      throw new ServiceUnavailableException(
        "Gemini API key chưa được cấu hình",
      );
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

  private normalizeConversationAnalysis(value: unknown): ModelAnalyzeResponse {
    const base = this.normalizeModelAnalysis(value);
    if (!value || typeof value !== "object") {
      return base;
    }

    const raw = value as Record<string, unknown>;
    const validActions = new Set(["FIND_DOCTORS", "REPLY", "CLARIFY"]);
    const rawIntent =
      typeof raw.intent === "string" ? raw.intent.toUpperCase() : "UNKNOWN";
    const rawAction =
      typeof raw.action === "string" ? raw.action.toUpperCase() : "CLARIFY";
    const conversationalIntent = CONVERSATION_INTENTS.has(rawIntent)
      ? (rawIntent as ModelAnalyzeResponse["intent"])
      : undefined;
    const isConversationalReply =
      rawAction === "REPLY" && Boolean(conversationalIntent);
    const action =
      typeof raw.action === "string" &&
        validActions.has(raw.action.toUpperCase())
        ? (raw.action.toUpperCase() as ModelAnalyzeResponse["action"])
        : base.action;
    const missingFields = Array.isArray(raw.missingFields)
      ? raw.missingFields.filter(
        (field): field is ClinicalField =>
          field === "duration" || field === "severity" || field === "age",
      )
      : base.missingFields;
    const followUpQuestion =
      typeof raw.followUpQuestion === "string"
        ? raw.followUpQuestion
        : base.followUpQuestion;
    const readyForRecommendation =
      isConversationalReply
        ? false
        : typeof raw.readyForRecommendation === "boolean"
        ? raw.readyForRecommendation
        : base.readyForRecommendation;
    const nextAction =
      typeof raw.nextAction === "string" &&
        [
          "ASK_FOLLOW_UP",
          "FIND_DOCTORS",
          "EMERGENCY",
          "REPLY",
          "CLARIFY",
        ].includes(raw.nextAction)
        ? (raw.nextAction as ModelAnalyzeResponse["nextAction"])
        : undefined;
    const field =
      typeof raw.field === "string" &&
        ["NONE", "duration", "severity", "age"].includes(raw.field)
        ? (raw.field as ModelAnalyzeResponse["field"])
        : undefined;
    const confidence = Number(raw.confidence);
    const policySource =
      raw.source === "MODEL" || raw.source === "RULE" ? raw.source : undefined;
    const analysisSource = raw.analysisSource === "Gemini" ? "Gemini" : "NER";

    return {
      ...base,
      analysisSource,
      intent: conversationalIntent ?? base.intent,
      action: isConversationalReply ? "REPLY" : action,
      missingFields,
      followUpQuestion: isConversationalReply ? null : followUpQuestion,
      readyForRecommendation,
      ...(nextAction ? { nextAction } : {}),
      ...(field ? { field } : {}),
      ...(Number.isFinite(confidence)
        ? { confidence: this.clampScore(confidence) }
        : {}),
      ...(policySource ? { policySource } : {}),
    };
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
      slots?: unknown;
      redFlags?: unknown;
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

    const slots = this.normalizeClinicalSlots(raw.slots);
    const redFlags = this.normalizeRedFlags(raw.redFlags);
    const specialties = [
      ...new Set([
        ...symptoms.map((symptom) => symptom.specialty_code),
        ...(redFlags.length ? ["EMERGENCY"] : []),
      ]),
    ];
    const baseAnalysis: ModelAnalyzeResponse = {
      symptoms,
      specialties,
      intent:
        symptoms.length || redFlags.length
          ? "SYMPTOM"
          : rawAction === "REPLY" && CONVERSATION_INTENTS.has(intent)
            ? intent
            : "UNKNOWN",
      action:
        symptoms.length || redFlags.length
          ? "FIND_DOCTORS"
          : rawAction === "REPLY" && CONVERSATION_INTENTS.has(intent)
            ? "REPLY"
            : "CLARIFY",
      slots,
      redFlags,
      missingFields: [],
      followUpQuestion: null,
      readyForRecommendation: false,
    };

    return this.withClinicalFollowUp(baseAnalysis);
  }

  private normalizeClinicalSlots(value: unknown): ClinicalSlots {
    const raw =
      value && typeof value === "object"
        ? (value as Record<string, unknown>)
        : {};
    return {
      duration: this.normalizeClinicalSlot(raw.duration),
      severity: this.normalizeClinicalSlot(raw.severity),
      age: this.normalizeClinicalSlot(raw.age),
    };
  }

  private normalizeClinicalSlot(value: unknown): ClinicalSlot | null {
    if (!value || typeof value !== "object") {
      return null;
    }

    const raw = value as Record<string, unknown>;
    if (typeof raw.text !== "string" || !raw.text.trim()) {
      return null;
    }

    const normalized: ClinicalSlot = { text: raw.text.trim() };
    if (typeof raw.value === "number" && Number.isFinite(raw.value)) {
      normalized.value = raw.value;
    }
    if (
      typeof raw.unit === "string" &&
      ["HOUR", "DAY", "WEEK", "MONTH", "YEAR"].includes(raw.unit)
    ) {
      normalized.unit = raw.unit as ClinicalSlot["unit"];
    }
    if (typeof raw.confidence === "number" && Number.isFinite(raw.confidence)) {
      normalized.confidence = this.clampScore(raw.confidence);
    }
    return normalized;
  }

  private normalizeRedFlags(value: unknown): ModelRedFlag[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }
        const raw = item as Record<string, unknown>;
        const code = typeof raw.code === "string" ? raw.code : "";
        const text = typeof raw.text === "string" ? raw.text : code;
        const confidence = Number(raw.confidence ?? 0);
        if (!code || !text || !Number.isFinite(confidence)) {
          return null;
        }
        return {
          code,
          text,
          confidence: this.clampScore(confidence),
        };
      })
      .filter((item): item is ModelRedFlag => Boolean(item));
  }

  /*
  Tổng hợp kết quả phân tích được:
    - Nếu thiếu -> Hỏi tiếp bằng hàm withClinicalFollowup.
    - Nếu đủ -> tổng hợp -> tìm chuyên khoa -> gợi ý bác sĩ.
  */
  private mergeAnalyses(
    previous: ModelAnalyzeResponse | undefined,
    current: ModelAnalyzeResponse,
  ): ModelAnalyzeResponse {
    if (!previous) {
      return current;
    }

    // A new medical description starts a new symptom snapshot. If the user is
    // only answering a follow-up question (for example "từ hôm qua"), keep
    // the previous snapshot so the conversation remains linked.
    const symptoms = current.symptoms.length
      ? current.symptoms.filter(
        (symptom, index, all) =>
          all.findIndex(
            (candidate) =>
              candidate.name === symptom.name &&
              candidate.specialty_code === symptom.specialty_code,
          ) === index,
      )
      : previous.symptoms;

    // Preserve emergency evidence across follow-up answers. A later answer
    // that does not repeat a red flag must not silently clear the warning.
    const redFlags = [...previous.redFlags, ...current.redFlags].filter(
      (flag, index, all) =>
        all.findIndex((candidate) => candidate.code === flag.code) === index,
    );
    // Each clinical field is scalar by design: the current message replaces
    // the previous value when it contains a newer answer. Never keep a list
    // of historical duration/severity/age values.
    const slots = {
      duration: current.slots.duration ?? previous.slots.duration,
      severity: current.slots.severity ?? previous.slots.severity,
      age: current.slots.age ?? previous.slots.age,
    };
    const specialties = [
      ...new Set([
        ...symptoms.map((symptom) => symptom.specialty_code),
        ...(redFlags.length ? ["EMERGENCY"] : []),
      ]),
    ].filter((specialty) => MEDICAL_SPECIALTY_CODES.has(specialty));

    return this.withClinicalFollowUp({
      ...current,
      symptoms,
      specialties,
      intent: symptoms.length || redFlags.length ? "SYMPTOM" : current.intent,
      action:
        symptoms.length || redFlags.length ? "FIND_DOCTORS" : current.action,
      slots,
      redFlags,
      missingFields: [],
      followUpQuestion: null,
      readyForRecommendation: false,
    });
  }

  /*
  Xác định các trường còn thiếu ví dụ thiết ngày, mức độ đau, tuổi tác:
    - Dùng hasClinicalEvidence để kiểm tra người dùng có đưa ra triệu chứng rõ ràng không
      + nếu false: hệ thống không hỏi duration, severity, age. => có thể là câu chào hỏi, cảm ơn, tạm biệt.
      + nếu true: tiếp tục thêm thông tin để gợi ý bác sĩ.
  */
  private withClinicalFollowUp(
    analysis: ModelAnalyzeResponse,
  ): ModelAnalyzeResponse {
    const hasClinicalEvidence =
      analysis.symptoms.length > 0 || analysis.redFlags.length > 0;
    if (!hasClinicalEvidence) {
      return {
        ...analysis,
        missingFields: [],
        followUpQuestion: null,
        readyForRecommendation: false,
        action: analysis.action === "REPLY" ? "REPLY" : "CLARIFY",
      };
    }

    const missingFields: ClinicalField[] = analysis.redFlags.length
      ? []
      : (["duration", "severity", "age"] as ClinicalField[]).filter(
        (field) => analysis.slots[field] === null,
      );
    const readyForRecommendation = missingFields.length === 0;
    return {
      ...analysis,
      intent: "SYMPTOM",
      action: readyForRecommendation ? "FIND_DOCTORS" : "CLARIFY",
      missingFields,
      followUpQuestion: missingFields.length
        ? this.buildClinicalFollowUpQuestion(missingFields[0])
        : null,
      readyForRecommendation,
    };
  }

  /*
  Tạo câu hỏi tiếp theo để hoàn thiện bộ data.
  */
  private buildClinicalFollowUpQuestion(field: ClinicalField) {
    switch (field) {
      case "duration":
        return "Các triệu chứng xuất hiện từ khi nào? Ví dụ: sáng nay, hôm qua, 2 ngày trước.";
      case "severity":
        return "Mức độ đau hoặc khó chịu hiện tại ra sao? Ví dụ: nhẹ, vừa phải, nặng hoặc dữ dội.";
      case "age":
        return "Người bệnh bao nhiêu tuổi?";
    }
  }

  /*
  Kiểm tra triệu chứng xem có ít nhất 1 triệu chứng trên 0.5 => true.
  */
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
- Nếu có, trích xuất thêm các trường lâm sàng: duration (thời gian xuất hiện), severity (mức độ đau/khó chịu), age (tuổi người bệnh). Không tự suy đoán giá trị còn thiếu; trường thiếu phải là null.
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
  "action": "FIND_DOCTORS",
  "slots": {
    "duration": {"text": "string", "value": 0, "unit": "DAY"},
    "severity": {"text": "string"},
    "age": {"text": "string", "value": 0, "unit": "YEAR"}
  },
  "redFlags": []
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
        userId: true,
        fullName: true,
        imageUrl: true,
        academicTitle: true,
        experienceYears: true,
        workplace: true,
        streetAddress: true,
        address: true,
        city: true,
        provinceCode: true,
        communeCode: true,
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
          const experienceScore = this.calculateExperienceScore(
            doctor.experienceYears,
          );
          const locationScore = distance?.locationScore ?? 0;
          const ratingScore = this.calculateRatingScore(
            doctor.rating?.toString() ?? null,
          );
          const doctorScore = this.calculateDoctorScore({
            specialtyScore,
            experienceScore,
            locationScore,
            ratingScore,
          });

          return {
            id: doctor.id,
            chatAvailable: Boolean(doctor.userId),
            fullName: doctor.fullName,
            imageUrl: doctor.imageUrl,
            academicTitle: doctor.academicTitle,
            experienceYears: doctor.experienceYears,
            workplace: doctor.workplace,
            streetAddress: doctor.streetAddress,
            address: doctor.address,
            city: doctor.city,
            provinceCode: doctor.provinceCode,
            communeCode: doctor.communeCode,
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
        communeCode: true,
        streetAddress: true,
      },
    });

    if (!user) {
      return null;
    }

    return {
      provinceCode: user.provinceCode,
      communeCode: user.communeCode,
      streetAddress: user.streetAddress,
    };
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
    experienceScore: number;
    locationScore: number;
    ratingScore: number;
  }) {
    return this.clampScore(
      scores.specialtyScore * 0.5 +
      scores.experienceScore * 0.15 +
      scores.ratingScore * 0.1 +
      scores.locationScore * 0.25,
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
      communeCode: number | null;
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
          communeCode: doctor.communeCode,
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
    const sameCommune = Boolean(
      sameProvince &&
      userLocation.communeCode &&
      doctorLocation.communeCode &&
      userLocation.communeCode === doctorLocation.communeCode,
    );

    if (
      sameCommune &&
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

    if (sameCommune) {
      return this.buildAdministrativeDistance(
        ADMINISTRATIVE_MATCH_LABELS.SAME_COMMUNE,
        0.8,
      );
    }

    if (sameProvince) {
      return this.buildAdministrativeDistance(
        ADMINISTRATIVE_MATCH_LABELS.SAME_PROVINCE,
        0.3,
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
    if (analysis.followUpQuestion && analysis.symptoms.length) {
      const symptomText = [
        ...new Set(analysis.symptoms.map((symptom) => symptom.name)),
      ].join(", ");
      return `Mình đã ghi nhận triệu chứng: ${symptomText}.\n\n${analysis.followUpQuestion}\n\nKhi đủ thông tin, mình sẽ tổng hợp và gợi ý bác sĩ phù hợp.`;
    }

    if (recommendedSpecialties.length) {
      const groupedSymptoms = recommendedSpecialties.map((specialty) => {
        const symptoms = analysis.symptoms
          .filter((item) => item.specialty_code === specialty.code)
          .map((item) => item.name);
        const symptomText = symptoms.length
          ? [...new Set(symptoms)].join(", ")
          : "cần mô tả thêm triệu chứng";

        return `• ${specialty.name}: ${symptomText}`;
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
            const recommendationReason = this.buildRecommendationReason(doctor);

            return `${index + 1}. ${title}\n\nĐiểm phù hợp: ${scorePercent}% — ${suitabilityLabel}\n\n• Mã bác sĩ: ${doctor.id}\n• Chuyên khoa: ${specialty.name}\n• Kinh nghiệm: ${doctor.experienceYears} năm\n• Đánh giá: ${doctor.rating ?? "chưa cập nhật"}/5\n• Nơi làm việc: ${doctor.workplace ?? "chưa cập nhật"}\n• Địa chỉ: ${doctor.address ?? doctor.city ?? "chưa cập nhật"}${distance}\n• Thời gian làm việc: ${workSchedule}\n• Hình thức tư vấn: ${consultationType}\n• Điện thoại: ${doctor.phoneNumber ?? "chưa cập nhật"}\n• Email: ${doctor.email ?? "chưa cập nhật"}\n• Chat trực tiếp: ${doctor.chatAvailable ? "Có" : "Chưa hỗ trợ"}\n\nLý do đề xuất: ${recommendationReason}`;
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
      return analysis.followUpQuestion || this.buildConversationReply(analysis.intent);
    }

    return this.buildClarificationReply();
  }

  private buildConversationReply(intent: ModelAnalyzeResponse["intent"]) {
    switch (intent) {
      case "GREETING":
        return "Xin chào! Tôi có thể giúp gì cho bạn?";
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
