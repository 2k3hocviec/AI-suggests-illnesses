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
    const hasEmergencySpecialty = this.hasEmergencySpecialty(analysis);
    const recommendedSpecialties =
      await this.findRecommendedSpecialties(analysis);
    const recommendedSpecialtiesWithDoctors = hasEmergencySpecialty
      ? this.withoutDoctorSuggestions(recommendedSpecialties)
      : await this.attachDoctorsToSpecialties(userId, recommendedSpecialties);
    const assistantContent = this.buildAssistantReply(
      analysis,
      recommendedSpecialtiesWithDoctors,
    );
    const [primarySpecialty] = recommendedSpecialtiesWithDoctors;

    const assistantMessage = await this.prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: ChatRole.ASSISTANT,
        content: assistantContent,
        metadata: analysis as unknown as Prisma.InputJsonValue,
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
          analysis.symptoms as unknown as Prisma.InputJsonValue,
        recommendedSpecialtyId: primarySpecialty?.id,
        emergency: hasEmergencySpecialty,
        emergencyLevel: hasEmergencySpecialty ? "EMERGENCY" : "NORMAL",
        emergencyReasons: hasEmergencySpecialty
          ? (analysis.symptoms as unknown as Prisma.InputJsonValue)
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
        ...analysis,
        recommendedSpecialty: primarySpecialty ?? null,
        recommendedSpecialties: recommendedSpecialtiesWithDoctors,
      },
    };
  }

  /*
  Lấy danh sách message của một phiên chat.
  */
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
    userId: number,
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
            locationScore: distance?.locationScore ?? null,
          };
        })
        .sort((firstDoctor, secondDoctor) => {
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

  private async findUserLocation(userId: number) {
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
        )}\n\nVới các triệu chứng cấp cứu, bạn không nên chờ gợi ý bác sĩ trên hệ thống. Hãy đến cơ sở y tế gần nhất hoặc gọi cấp cứu để được thăm khám và điều trị kịp thời.\n\nThông tin này chỉ mang tính tham khảo, không thay thế chẩn đoán của bác sĩ.`;
      }

      const doctorSuggestions = recommendedSpecialties.map((specialty) => {
        if (!specialty.doctors.length) {
          return `Chuyên khoa: ${specialty.name}\nChưa có bác sĩ phù hợp trong hệ thống.`;
        }

        const doctors = specialty.doctors
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
            const rating = doctor.rating ? ` · Đánh giá: ${doctor.rating}` : "";
            const distance = doctor.distanceText
              ? `\n   o   Khu vực: ${doctor.distanceText}`
              : "";
            const locationScore =
              doctor.locationScore !== null
                ? `\n   o   Điểm khu vực: ${doctor.locationScore.toFixed(2)}/1.0`
                : "";

            return `${index + 1}. ${title}\n   o   Kinh nghiệm: ${doctor.experienceYears} năm${rating}\n   o   Nơi làm việc: ${doctor.workplace ?? "chưa cập nhật"}\n   o   Địa chỉ: ${doctor.address ?? doctor.city ?? "chưa cập nhật"}${distance}${locationScore}\n   o   Lịch làm việc: ${doctor.workingTime ?? "chưa cập nhật"}\n   o   Hình thức: ${consultationType}\n   o   Liên hệ: ${doctor.phoneNumber ?? "chưa cập nhật"}${doctor.email ? ` · ${doctor.email}` : ""}`;
          })
          .join("\n\n");

        return `Chuyên khoa: ${specialty.name}\n\n${doctors}`;
      });

      return `Mình ghi nhận các nhóm chuyên khoa phù hợp với triệu chứng của bạn:\n\n${groupedSymptoms.join(
        "\n",
      )}\n\nDanh sách bác sĩ chuyên khoa phù hợp\n\n${doctorSuggestions.join(
        "\n\n",
      )}\n\nThông tin này chỉ mang tính tham khảo, không thay thế chẩn đoán của bác sĩ.`;
    }

    return `${analysis.message}`;
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
