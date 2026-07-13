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
import { ModelAnalyzeResponse, SpecialtyHint } from "./chat.types";

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

const EMERGENCY_KEYWORDS = [
  "đau ngực dữ dội",
  "khó thở nặng",
  "ngất",
  "liệt",
  "co giật",
  "chảy máu nhiều",
  "mất ý thức",
];

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
    const userMessage = await this.prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        userId,
        role: ChatRole.USER,
        content,
      },
    });

    const analysis = await this.analyze(content);
    const recommendedSpecialty = await this.findRecommendedSpecialty(analysis);
    const assistantContent = this.buildAssistantReply(
      analysis,
      recommendedSpecialty,
    );

    const assistantMessage = await this.prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: ChatRole.ASSISTANT,
        content: assistantContent,
        metadata: analysis as unknown as Prisma.InputJsonValue,
      },
    });

    await this.prisma.consultationHistory.create({
      data: {
        userId,
        chatSessionId: session.id,
        userMessageId: userMessage.id,
        originalMessage: content,
        extractedSymptoms:
          analysis.symptoms as unknown as Prisma.InputJsonValue,
        recommendedSpecialtyId: recommendedSpecialty?.id,
        emergency: this.isEmergency(content),
        emergencyLevel: this.isEmergency(content) ? "EMERGENCY" : "NORMAL",
        emergencyReasons: this.getEmergencyReasons(
          content,
        ) as Prisma.InputJsonValue,
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
        ...analysis,
        recommendedSpecialty,
      },
    };
  }

  /*
  Lấy danh sách message của một phiên chat.
  */
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

  private async analyze(content: string): Promise<ModelAnalyzeResponse> {
    const modelUrl =
      this.config.get<string>("aiServiceUrl") ??
      this.config.get<string>("AI_SERVICE_URL") ??
      "http://localhost:5678";
    const endpoint = this.config.get<string>(
      "PYTHON_API_ENDPOINT",
      "/api/extract-symptoms",
    );

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(`${modelUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: content }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new ServiceUnavailableException("Model chưa sẵn sàng");
      }

      return (await response.json()) as ModelAnalyzeResponse;
    } catch {
      return this.fallbackAnalyze(content);
    }
  }

  private fallbackAnalyze(content: string): ModelAnalyzeResponse {
    const normalized = this.normalize(content);
    const symptoms = SPECIALTY_HINTS.flatMap((hint) =>
      hint.keywords
        .filter((keyword) => normalized.includes(this.normalize(keyword)))
        .map((keyword) => ({
          name: keyword,
          confidence: 0.65,
          specialty_code: hint.code,
        })),
    );
    const specialties = [
      ...new Set(symptoms.map((item) => item.specialty_code)),
    ];

    return {
      symptoms,
      specialties,
      message: symptoms.length
        ? `Tìm thấy ${symptoms.length} triệu chứng và ${specialties.length} chuyên khoa phù hợp.`
        : "Chưa nhận diện được triệu chứng rõ ràng. Bạn có thể mô tả cụ thể hơn về vị trí đau, thời gian kéo dài và mức độ nặng nhẹ.",
    };
  }

  private async findRecommendedSpecialty(analysis: ModelAnalyzeResponse) {
    const [code] = analysis.specialties;
    if (!code) {
      return null;
    }

    const fallback = SPECIALTY_HINTS.find((hint) => hint.code === code);
    const specialty = await this.prisma.specialty.findUnique({
      where: {
        code,
      },
      select: {
        id: true,
        code: true,
        name: true,
      },
    });

    return (
      specialty ??
      (fallback
        ? {
            id: null,
            code: fallback.code,
            name: fallback.name,
          }
        : null)
    );
  }

  private buildAssistantReply(
    analysis: ModelAnalyzeResponse,
    recommendedSpecialty: { code: string; name: string } | null,
  ) {
    if (recommendedSpecialty) {
      const symptomText = analysis.symptoms.length
        ? `Mình ghi nhận các triệu chứng: ${analysis.symptoms
            .map((item) => item.name)
            .join(", ")}.`
        : analysis.message;

      return `${symptomText} Gợi ý chuyên khoa phù hợp để tham khảo là ${recommendedSpecialty.name}. Thông tin này chỉ mang tính tham khảo, không thay thế chẩn đoán của bác sĩ. Nếu triệu chứng nặng lên, xuất hiện đau dữ dội, khó thở, ngất hoặc sốt cao kéo dài, bạn nên liên hệ cơ sở y tế gần nhất.`;
    }

    return `${analysis.message} Bạn hãy mô tả thêm triệu chứng chính, vị trí, thời gian xuất hiện và mức độ đau để mình gợi ý chuyên khoa chính xác hơn.`;
  }

  private isEmergency(content: string) {
    const normalized = this.normalize(content);
    return EMERGENCY_KEYWORDS.some((keyword) =>
      normalized.includes(this.normalize(keyword)),
    );
  }

  private getEmergencyReasons(content: string) {
    const normalized = this.normalize(content);
    return EMERGENCY_KEYWORDS.filter((keyword) =>
      normalized.includes(this.normalize(keyword)),
    );
  }

  private normalize(value: string) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase();
  }
}
