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
  RecommendedSpecialty,
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
    const recommendedSpecialties =
      await this.findRecommendedSpecialties(analysis);
    const assistantContent = this.buildAssistantReply(
      analysis,
      recommendedSpecialties,
    );
    const [primarySpecialty] = recommendedSpecialties;

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
        recommendedSpecialtyId: primarySpecialty?.id,
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
        recommendedSpecialty: primarySpecialty ?? null,
        recommendedSpecialties,
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
      const analysis = (await response.json()) as ModelAnalyzeResponse;
      console.log("Đã gửi sang model:", content);
      console.log("Model trả về:", analysis);

      return analysis;
    } catch (error) {
      console.error("Không gọi được model, dùng fallback:", error);
      return this.fallbackAnalyze(content);
    }
  }

  /*
  Chạy khi model chết, sẽ phát triển thêm lên khi gọi model trả về độ tin tưởng còn quá thấp.
  */
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

  /*
  Nhóm các triệu chứng cùng chuyên khoa lại với nhau
  */
  private buildAssistantReply(
    analysis: ModelAnalyzeResponse,
    recommendedSpecialties: RecommendedSpecialty[],
  ) {
    if (recommendedSpecialties.length) {
      const groupedSymptoms = recommendedSpecialties.map((specialty) => {
        const symptoms = analysis.symptoms
          .filter((item) => item.specialty_code === specialty.code)
          .map((item) => item.name);
        const symptomText = symptoms.length
          ? [...new Set(symptoms)].join(", ")
          : "cần mô tả thêm triệu chứng";

        return `- ${specialty.name}: ${symptomText}.`;
      });

      return `Mình ghi nhận các nhóm chuyên khoa phù hợp:\n${groupedSymptoms.join(
        "\n",
      )}\n\nThông tin này chỉ mang tính tham khảo, không thay thế chẩn đoán của bác sĩ.`;
    }

    return `${analysis.message}`;
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
