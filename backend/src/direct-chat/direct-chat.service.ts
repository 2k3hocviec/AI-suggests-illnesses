import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  DirectChatStatus,
  DoctorStatus,
  Prisma,
  UserRole,
} from "@prisma/client";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";

const conversationInclude = {
  patient: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  doctor: {
    select: {
      id: true,
      userId: true,
      fullName: true,
      imageUrl: true,
      academicTitle: true,
      email: true,
      phoneNumber: true,
      workplace: true,
      specialty: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
      user: {
        select: {
          id: true,
          isEnabled: true,
          role: true,
        },
      },
    },
  },
  messages: {
    orderBy: {
      createdAt: "desc",
    },
    take: 1,
    select: {
      id: true,
      senderId: true,
      content: true,
      createdAt: true,
      readAt: true,
    },
  },
} satisfies Prisma.DirectChatConversationInclude;

/*
Prisma suy luận và lấy được các thuộc tính dựa cào conversationInclude đã lấy ở bên trên: 
  - conversation.patient
  - conversation.doctor
  - conversation.doctor.specialty
  - conversation.messages
*/
type ConversationRecord = Prisma.DirectChatConversationGetPayload<{
  include: typeof conversationInclude;
}>;

@Injectable()
export class DirectChatService {
  constructor(private readonly prisma: PrismaService) {}

  /*
  Người dùng gửi yêu cầu chat trực tiếp:
    - B1: Tìm toàn khoản gửi yêu cầu bằng patientID.
    - B2: Kiểm tra tài khoản có đủ yêu cầu.
    - B3: Tìm bác sĩ được yêu cầu.
    - B4: Kiểm tra tài khoản bác sĩ đó.
    - B5: Kiểm tra người dùng có phiên chat nào với bác sĩ này trước đó chưa, nếu có thì sẽ tiếp tục phiên chat trước đó, không thì tạo mới.
  */
  async requestConversation(
    patientId: number,
    doctorId: number,
    consultationSummary?: string,
  ) {
    const patient = await this.prisma.user.findUnique({
      where: { id: patientId },
      select: {
        id: true,
        role: true,
        isEnabled: true,
      },
    });

    if (!patient?.isEnabled || patient.role !== UserRole.USER) {
      throw new ForbiddenException(
        "Chỉ tài khoản người dùng mới có thể gửi yêu cầu chat bác sĩ",
      );
    }

    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
      include: {
        user: {
          select: {
            id: true,
            role: true,
            isEnabled: true,
          },
        },
      },
    });

    if (!doctor || doctor.status !== DoctorStatus.ACTIVE) {
      throw new NotFoundException("Không tìm thấy bác sĩ đang hoạt động");
    }

    if (
      !doctor.user ||
      doctor.user.role !== UserRole.DOCTOR ||
      !doctor.user.isEnabled
    ) {
      throw new BadRequestException("Bác sĩ này chưa hỗ trợ chat trực tiếp");
    }

    const existing = await this.prisma.directChatConversation.findFirst({
      where: {
        patientId,
        doctorId,
        status: {
          in: [DirectChatStatus.PENDING, DirectChatStatus.ACTIVE],
        },
      },
      include: conversationInclude,
      orderBy: {
        updatedAt: "desc",
      },
    });

    if (existing) {
      const restored = existing.patientDeletedAt
        ? await this.prisma.directChatConversation.update({
            where: { id: existing.id },
            data: { patientDeletedAt: null },
            include: conversationInclude,
          })
        : existing;

      await this.addConsultationSummary(
        restored.id,
        patientId,
        consultationSummary,
      );
      const current = await this.getConversationRecord(restored.id);

      return {
        created: false,
        doctorUserId: doctor.user.id,
        conversation: await this.toConversationView(current, patientId),
      };
    }

    const conversation = await this.prisma.directChatConversation.create({
      data: {
        patientId,
        doctorId,
      },
      include: conversationInclude,
    });
    await this.addConsultationSummary(
      conversation.id,
      patientId,
      consultationSummary,
    );
    const current = await this.getConversationRecord(conversation.id);

    return {
      created: true,
      doctorUserId: doctor.user.id,
      conversation: await this.toConversationView(current, patientId),
    };
  }

  private async addConsultationSummary(
    conversationId: number,
    patientId: number,
    consultationSummary?: string,
  ) {
    const summary = consultationSummary?.trim();
    if (!summary) {
      return;
    }

    await this.prisma.directChatMessage.create({
      data: {
        conversationId,
        senderId: patientId,
        clientMessageId: randomUUID(),
        content: `Thông tin đã chọn từ HealthAI:\n\n${summary}`,
      },
    });
  }

  /*
  Lấy danh sách các phiên chat theo UserID:
    - User: lấy phiên chat có patientID.
    - Doctor: lấy phiên chat thuộc hồ sơ bác sĩ liên kết với tài khoản đó.
    - Admin: thì không có quyền truy cập hộp thử.
  */
  async listConversations(userId: number) {
    const user = await this.getEnabledUser(userId);
    const where: Prisma.DirectChatConversationWhereInput =
      user.role === UserRole.USER
        ? { patientId: user.id, patientDeletedAt: null }
        : user.role === UserRole.DOCTOR
          ? {
              doctor: {
                userId: user.id,
              },
              doctorDeletedAt: null,
            }
          : {
              id: -1,
            };

    if (user.role !== UserRole.USER && user.role !== UserRole.DOCTOR) {
      throw new ForbiddenException(
        "Tài khoản này không có hộp thư chat trực tiếp",
      );
    }

    const conversations = await this.prisma.directChatConversation.findMany({
      where,
      include: conversationInclude,
      orderBy: {
        updatedAt: "desc",
      },
    });

    return Promise.all(
      conversations.map((conversation) =>
        this.toConversationView(conversation, userId),
      ),
    );
  }

  /*
  Khi bác sĩ nhấn chấp nhận trờ chuyện:
    - B1: Lấy phiên chat từ database.
    - B2: Kiểm tra người dùng đang thao tác có phải là bác sĩ
    - B3: Nếu phiên chat đã ACTIVE, trả lại phiên hiện tại, lặp an toàn.
    - B4: Nếu không phải PENDING thì trả lỗi
    => Đính kèm thêm patientID để gateway gửi thông báo "Bác sĩ đã chấp nhận"
  */
  async acceptConversation(doctorUserId: number, conversationId: number) {
    const conversation = await this.getConversationRecord(conversationId);
    this.assertDoctorParticipant(doctorUserId, conversation);

    if (conversation.status === DirectChatStatus.ACTIVE) {
      return {
        patientId: conversation.patientId,
        conversation: await this.toConversationView(conversation, doctorUserId),
      };
    }

    if (conversation.status !== DirectChatStatus.PENDING) {
      throw new ConflictException(
        "Yêu cầu này không còn ở trạng thái chờ xác nhận",
      );
    }

    const updated = await this.prisma.directChatConversation.update({
      where: { id: conversationId },
      data: {
        status: DirectChatStatus.ACTIVE,
        respondedAt: new Date(),
      },
      include: conversationInclude,
    });

    return {
      patientId: updated.patientId,
      conversation: await this.toConversationView(updated, doctorUserId),
    };
  }

  /*
  Dùng khi bác sĩ không chấp nhận phiên chat.
  */
  async rejectConversation(doctorUserId: number, conversationId: number) {
    const conversation = await this.getConversationRecord(conversationId);
    this.assertDoctorParticipant(doctorUserId, conversation);

    if (conversation.status !== DirectChatStatus.PENDING) {
      throw new ConflictException(
        "Yêu cầu này không còn ở trạng thái chờ xác nhận",
      );
    }

    const updated = await this.prisma.directChatConversation.update({
      where: { id: conversationId },
      data: {
        status: DirectChatStatus.REJECTED,
        respondedAt: new Date(),
      },
      include: conversationInclude,
    });

    return {
      patientId: updated.patientId,
      conversation: await this.toConversationView(updated, doctorUserId),
    };
  }

  /*
  Đóng phiên chat theo yêu cầu
  */
  async closeConversation(userId: number, conversationId: number) {
    const conversation = await this.getConversationRecord(conversationId);
    this.assertParticipant(userId, conversation);
    this.assertConversationVisible(userId, conversation);

    if (conversation.status === DirectChatStatus.CLOSED) {
      return {
        recipientId: this.getRecipientId(userId, conversation),
        conversation: await this.toConversationView(conversation, userId),
      };
    }

    if (conversation.status !== DirectChatStatus.ACTIVE) {
      throw new ConflictException("Chỉ có thể đóng phiên chat đang hoạt động");
    }

    const updated = await this.prisma.directChatConversation.update({
      where: { id: conversationId },
      data: {
        status: DirectChatStatus.CLOSED,
        closedAt: new Date(),
      },
      include: conversationInclude,
    });

    return {
      recipientId: this.getRecipientId(userId, updated),
      conversation: await this.toConversationView(updated, userId),
    };
  }

  /*
  Xóa mềm cuộc hội thoại, hoạt đóng:
    - Khi đó ở bác sĩ hoặc user cũng sẽ đóng phiên trả chuyện để tránh lỗi khi cuộc trò chuyện đã xóa mà vẫn còn người chat làm người còn lại không nhận được tin nhắn
  */
  async deleteConversation(userId: number, conversationId: number) {
    const conversation = await this.getConversationRecord(conversationId);
    this.assertParticipant(userId, conversation);

    const deletedAt = new Date();
    const data: Prisma.DirectChatConversationUpdateInput =
      conversation.patientId === userId
        ? {
            patientDeletedAt: deletedAt,
            status: DirectChatStatus.CLOSED,
            closedAt: conversation.closedAt ?? deletedAt,
            deletedAt,
          }
        : {
            doctorDeletedAt: deletedAt,
            status: DirectChatStatus.CLOSED,
            closedAt: conversation.closedAt ?? deletedAt,
            deletedAt,
          };

    const updated = await this.prisma.directChatConversation.update({
      where: { id: conversationId },
      data,
      include: conversationInclude,
    });

    return {
      id: conversationId,
      deletedAt,
      recipientId: this.getRecipientId(userId, updated),
      conversation: await this.toConversationView(updated, userId),
    };
  }

  /*
  Lấy toàn bộ tin nhắn của một phiên chat:
    - Kiểm tra phiên chat có tồn tại không ?
    - Người đang xem có phải người dùng hoặc bác sĩ trong phiên chat không.
    - Phiên phải ACTIVE hoặc CLOSED.
  */
  async listMessages(userId: number, conversationId: number) {
    const conversation = await this.getConversationRecord(conversationId);
    this.assertParticipant(userId, conversation);
    this.assertConversationVisible(userId, conversation);
    this.assertConversationReadable(conversation.status);

    return this.prisma.directChatMessage.findMany({
      where: {
        conversationId,
      },
      select: {
        id: true,
        conversationId: true,
        senderId: true,
        clientMessageId: true,
        content: true,
        createdAt: true,
        readAt: true,
        sender: {
          select: {
            id: true,
            fullName: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });
  }

  /*
  Khi WebSocket muốn cho một client tham gia phòng Socket.IO
  */
  async joinConversation(userId: number, conversationId: number) {
    const conversation = await this.getConversationRecord(conversationId);
    this.assertParticipant(userId, conversation);
    this.assertConversationVisible(userId, conversation);
    this.assertConversationReadable(conversation.status);

    return {
      conversation,
      recipientId: this.getRecipientId(userId, conversation),
    };
  }

  /*
  Hàm dùng để gửi một tin nhắn:
    - Chuẩn hóa tin nhắn: xóa khoảng trắng đầu và cuối, nội dung không rỗng, 200 ký tử.
    - Kiểm tra người gửi có thuộc phiên chat không.
    - Chỉ chon gửi khi trạng thái ACTIVE.
    - Xử lý clientMessageID
      + clentMessageID giúp chống gửi trùng. Ví dụ mạng chập chờn kiến frontend gửi cùng một tin nhắn. 
      + Backend nhận ra tin đã tồn tại nên trả lại tin cũ thay vì tạo thêm tin nhắn mới
    - Dùng transaction đảm bảo hai thao tác cùng thành công hoặc cùng thất bại.
      + Thao tác 1: Tạo lưu tin nhắn.
      + Thao tác 2: Cập nhật phiên chat.
      => Thành công commi cả hai. 
      => Thất bại, không cập nhật updateAt.
      * Không dùng transaction, có thể xảy ra trường hợp tin nhắn đã được lưu nhưng phiên chat không cập nhật thời gian, kiến phiên có tin mới nhưng vẫn nằm dưới các phiên cũ.
  */
  async sendMessage(
    userId: number,
    input: {
      conversationId: number;
      content: string;
      clientMessageId?: string;
    },
  ) {
    const content = input.content.trim();
    if (!content) {
      throw new BadRequestException("Tin nhắn không được để trống");
    }
    if (content.length > 2000) {
      throw new BadRequestException("Tin nhắn tối đa 2000 ký tự");
    }

    const conversation = await this.getConversationRecord(input.conversationId);
    this.assertParticipant(userId, conversation);
    this.assertConversationVisible(userId, conversation);

    if (conversation.status !== DirectChatStatus.ACTIVE) {
      throw new ConflictException(
        "Phiên chat chỉ hoạt động sau khi bác sĩ chấp nhận yêu cầu",
      );
    }

    const clientMessageId = input.clientMessageId?.trim() || randomUUID();
    const existing = await this.prisma.directChatMessage.findUnique({
      where: {
        clientMessageId,
      },
      select: {
        id: true,
        conversationId: true,
        senderId: true,
        clientMessageId: true,
        content: true,
        createdAt: true,
        readAt: true,
        sender: {
          select: {
            id: true,
            fullName: true,
            role: true,
          },
        },
      },
    });

    if (existing) {
      if (
        existing.senderId !== userId ||
        existing.conversationId !== input.conversationId
      ) {
        throw new ConflictException("Mã tin nhắn đã được sử dụng");
      }

      return {
        created: false,
        recipientId: this.getRecipientId(userId, conversation),
        message: existing,
      };
    }

    const [message] = await this.prisma.$transaction([
      this.prisma.directChatMessage.create({
        data: {
          conversationId: input.conversationId,
          senderId: userId,
          clientMessageId,
          content,
        },
        select: {
          id: true,
          conversationId: true,
          senderId: true,
          clientMessageId: true,
          content: true,
          createdAt: true,
          readAt: true,
          sender: {
            select: {
              id: true,
              fullName: true,
              role: true,
            },
          },
        },
      }),
      this.prisma.directChatConversation.update({
        where: {
          id: input.conversationId,
        },
        data: {
          updatedAt: new Date(),
        },
      }),
    ]);

    return {
      created: true,
      recipientId: this.getRecipientId(userId, conversation),
      message,
    };
  }

  async markRead(userId: number, conversationId: number) {
    const conversation = await this.getConversationRecord(conversationId);
    this.assertParticipant(userId, conversation);
    this.assertConversationVisible(userId, conversation);
    this.assertConversationReadable(conversation.status);

    const readAt = new Date();
    const result = await this.prisma.directChatMessage.updateMany({
      where: {
        conversationId,
        senderId: {
          not: userId,
        },
        readAt: null,
      },
      data: {
        readAt,
      },
    });

    return {
      conversationId,
      readerId: userId,
      readAt,
      count: result.count,
    };
  }

  /*
  Kiểm tra user có đang hoạt động không
  */
  private async getEnabledUser(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        isEnabled: true,
      },
    });

    if (!user?.isEnabled) {
      throw new ForbiddenException("Tài khoản không hoạt động");
    }

    return user;
  }

  /*
  Tìm một cuộc trò chuyện theo ID và dữ liệu
  */
  private async getConversationRecord(conversationId: number) {
    const conversation = await this.prisma.directChatConversation.findUnique({
      where: {
        id: conversationId,
      },
      include: conversationInclude,
    });

    if (!conversation) {
      throw new NotFoundException("Không tìm thấy cuộc trò chuyện");
    }

    return conversation;
  }

  /*
  Kiểm tra người dùng có thuộc phiên chat không
  */
  private assertParticipant(userId: number, conversation: ConversationRecord) {
    if (
      conversation.patientId !== userId &&
      conversation.doctor.userId !== userId
    ) {
      throw new ForbiddenException(
        "Bạn không có quyền truy cập cuộc trò chuyện này",
      );
    }
  }

  private assertConversationVisible(
    userId: number,
    conversation: ConversationRecord,
  ) {
    const isPatient = conversation.patientId === userId;
    const isDoctor = conversation.doctor.userId === userId;
    const isHidden = isPatient
      ? Boolean(conversation.patientDeletedAt)
      : isDoctor
        ? Boolean(conversation.doctorDeletedAt)
        : false;

    if (isHidden) {
      throw new NotFoundException("Cuộc trò chuyện không còn tồn tại");
    }
  }

  /*
  Kiểm tra bác sĩ xử lý yêu cầu có phải là bác sĩ được người dùng yêu cầu không
  */
  private assertDoctorParticipant(
    userId: number,
    conversation: ConversationRecord,
  ) {
    if (conversation.doctor.userId !== userId) {
      throw new ForbiddenException(
        "Chỉ bác sĩ được yêu cầu mới có thể xử lý yêu cầu này",
      );
    }
  }

  /*
  Chỉ cho phép đọc hoặc tham gia phiên chat khi trạng thái:
    - ACTIVE.
    - CLOSED.
  Các trạng thái bị từ chối:
    - PENDING.
    - REJECTED.
  */
  private assertConversationReadable(status: DirectChatStatus) {
    if (
      status !== DirectChatStatus.ACTIVE &&
      status !== DirectChatStatus.CLOSED
    ) {
      throw new ConflictException("Phiên chat chưa được bác sĩ chấp nhận");
    }
  }

  private getRecipientId(senderId: number, conversation: ConversationRecord) {
    const recipientId =
      conversation.patientId === senderId
        ? conversation.doctor.userId
        : conversation.patientId;

    if (!recipientId) {
      throw new BadRequestException("Bác sĩ chưa có tài khoản nhận tin nhắn");
    }

    return recipientId;
  }

  /*
  Định dạng lại dữ liệu để trả về cho frontend:
    - ID và trạng thái phiên.
    - Các mốc thời gian.
    - Thông tin người dùng.
    - Thông tin bác sĩ.
    - Tin nhắn cuối cùng. 
    - Số tin nhắn chưa đọc.
  */
  private async toConversationView(
    conversation: ConversationRecord,
    viewerId: number,
  ) {
    const unreadCount = await this.prisma.directChatMessage.count({
      where: {
        conversationId: conversation.id,
        senderId: {
          not: viewerId,
        },
        readAt: null,
      },
    });

    return {
      id: conversation.id,
      status: conversation.status,
      requestedAt: conversation.requestedAt,
      respondedAt: conversation.respondedAt,
      closedAt: conversation.closedAt,
      deletedAt: conversation.deletedAt,
      updatedAt: conversation.updatedAt,
      patient: conversation.patient,
      doctor: {
        id: conversation.doctor.id,
        fullName: conversation.doctor.fullName,
        imageUrl: conversation.doctor.imageUrl,
        academicTitle: conversation.doctor.academicTitle,
        email: conversation.doctor.email,
        phoneNumber: conversation.doctor.phoneNumber,
        workplace: conversation.doctor.workplace,
        specialty: conversation.doctor.specialty,
      },
      lastMessage: conversation.messages[0] ?? null,
      unreadCount,
    };
  }
}
