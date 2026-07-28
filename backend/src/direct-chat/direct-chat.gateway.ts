import { JwtService } from "@nestjs/jwt";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { UserRole } from "@prisma/client";
import { Server, Socket } from "socket.io";
import { JwtUserPayload } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { DirectChatService } from "./direct-chat.service";

interface SocketUser {
  id: number;
  role: UserRole;
}

@WebSocketGateway({
  namespace: "/direct-chat",
  cors: {
    origin: true,
    credentials: true,
  },
})
export class DirectChatGateway implements OnGatewayConnection {
  @WebSocketServer()
  private server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly directChatService: DirectChatService,
  ) {}

  /*
  Thiết lập kết nối:
    - B1: Lấy accessToken.
    - B2: Verify JWT.
    - B3: Tìm tài khoản và kiểm tra tài khoản có hoạt động không.
    - B4: Lưu thông tin người dùng vào client.data.user.
    - B5: Cho socket tham gia phòng cá nhân.
  */
  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        throw new Error("Thiếu access token");
      }

      const payload = await this.jwtService.verifyAsync<JwtUserPayload>(token);
      const user = await this.prisma.user.findUnique({
        where: {
          id: payload.sub,
        },
        select: {
          id: true,
          role: true,
          isEnabled: true,
        },
      });

      if (!user?.isEnabled) {
        throw new Error("Tài khoản không hoạt động");
      }

      client.data.user = {
        id: user.id,
        role: user.role,
      } satisfies SocketUser;
      await client.join(this.userRoom(user.id));
      client.emit("socket:ready", {
        userId: user.id,
      });
    } catch (error) {
      client.emit("socket:error", {
        message: this.getErrorMessage(error),
      });
      client.disconnect(true);
    }
  }

  /*
  Cho người dùng vào phòng chat từ sư kiện mà frontend gửi đến, Gateway sẽ:
    - B1: Lấy ID người đang kết nối.
    - B2: Kiểm tra conversationId
    - B3: Gọi joinConversation kiểm tra quyền.
    - B4: Cho Sokcet vào phòng Socket.IO.
    - B5: Đánh dấu tin nhắn đã đọc bằng receipt.count > 0.
  */
  @SubscribeMessage("conversation:join")
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId?: number },
  ) {
    try {
      const user = this.getSocketUser(client);
      const conversationId = this.parseConversationId(body.conversationId);
      await this.directChatService.joinConversation(user.id, conversationId);
      await client.join(this.conversationRoom(conversationId));
      const receipt = await this.directChatService.markRead(
        user.id,
        conversationId,
      );

      if (receipt.count > 0) {
        this.server
          .to(this.conversationRoom(conversationId))
          .emit("message:read", receipt);
      }

      return {
        ok: true,
        conversationId,
      };
    } catch (error) {
      return {
        ok: false,
        error: this.getErrorMessage(error),
      };
    }
  }

  /*
  Dùng để đưa kết nối WebSocket ra khỏi một phòng chat khi người dùng không còn mở phiên đó.
  */
  @SubscribeMessage("conversation:leave")
  async handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId?: number },
  ) {
    const conversationId = this.parseConversationId(body.conversationId);
    await client.leave(this.conversationRoom(conversationId));
    return {
      ok: true,
      conversationId,
    };
  }

  @SubscribeMessage("message:send")
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: {
      conversationId?: number;
      content?: string;
      clientMessageId?: string;
    },
  ) {
    try {
      const user = this.getSocketUser(client);
      const conversationId = this.parseConversationId(body.conversationId);
      const result = await this.directChatService.sendMessage(user.id, {
        conversationId,
        content: body.content ?? "",
        clientMessageId: body.clientMessageId,
      });
      await client.join(this.conversationRoom(conversationId));

      if (result.created) {
        this.server
          .to(this.conversationRoom(conversationId))
          .emit("message:new", result.message);
        this.server
          .to(this.userRoom(result.recipientId))
          .emit("notification:new", {
            type: "MESSAGE",
            title: "Bạn có tin nhắn mới",
            message: `${result.message.sender.fullName}: ${result.message.content}`,
            conversationId,
            createdAt: result.message.createdAt,
          });
      }

      return {
        ok: true,
        message: result.message,
      };
    } catch (error) {
      return {
        ok: false,
        error: this.getErrorMessage(error),
      };
    }
  }

  @SubscribeMessage("message:read")
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId?: number },
  ) {
    try {
      const user = this.getSocketUser(client);
      const conversationId = this.parseConversationId(body.conversationId);
      const receipt = await this.directChatService.markRead(
        user.id,
        conversationId,
      );
      this.server
        .to(this.conversationRoom(conversationId))
        .emit("message:read", receipt);

      return {
        ok: true,
        receipt,
      };
    } catch (error) {
      return {
        ok: false,
        error: this.getErrorMessage(error),
      };
    }
  }

  /*
  Thông báo cho bác sĩ biết có người muốn tạo phòng chat trực tiếp. 
  */
  notifyRequestCreated(
    doctorUserId: number,
    conversation: Record<string, unknown>,
  ) {
    this.server
      .to(this.userRoom(doctorUserId))
      .emit("request:new", conversation);
    this.server.to(this.userRoom(doctorUserId)).emit("notification:new", {
      type: "REQUEST",
      title: "Yêu cầu chat mới",
      message: "Một người dùng muốn chat trực tiếp với bạn.",
      conversationId: conversation.id,
      createdAt: new Date().toISOString(),
    });
  }

  /*
  Thông báo cho người patient bác sĩ đã tham gia kênh chat.
  */
  notifyRequestUpdated(
    recipientId: number,
    conversation: Record<string, unknown>,
    accepted: boolean,
  ) {
    this.server
      .to(this.userRoom(recipientId))
      .emit("request:updated", conversation);
    this.server.to(this.userRoom(recipientId)).emit("notification:new", {
      type: accepted ? "REQUEST_ACCEPTED" : "REQUEST_REJECTED",
      title: accepted ? "Bác sĩ đã chấp nhận" : "Bác sĩ đã từ chối",
      message: accepted
        ? "Bạn có thể bắt đầu phiên chat trực tiếp ngay bây giờ."
        : "Yêu cầu chat trực tiếp của bạn đã bị từ chối.",
      conversationId: conversation.id,
      createdAt: new Date().toISOString(),
    });
  }

  notifyConversationClosed(
    recipientId: number,
    conversation: Record<string, unknown>,
  ) {
    const conversationId = conversation.id;
    this.server
      .to(this.conversationRoom(Number(conversationId)))
      .emit("conversation:closed", conversation);
    this.server.to(this.userRoom(recipientId)).emit("notification:new", {
      type: "CONVERSATION_CLOSED",
      title: "Cuộc trò chuyện đã kết thúc",
      message: "Cuộc trò chuyện với bạn đã được đóng.",
      conversationId,
      createdAt: new Date().toISOString(),
    });
  }

  emitReadReceipt(conversationId: number, receipt: Record<string, unknown>) {
    this.server
      .to(this.conversationRoom(conversationId))
      .emit("message:read", receipt);
  }

  /*Lấy acccessTokne từ client.handshake.auth.token*/
  private extractToken(client: Socket) {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === "string" && authToken.trim()) {
      return authToken.trim();
    }

    const authorization = client.handshake.headers.authorization;
    if (!authorization) {
      return undefined;
    }

    const [type, token] = authorization.split(" ");
    return type === "Bearer" ? token : undefined;
  }

  /*
  Lấy thông tin tài khoản đã được xác thực cả kết nối WebSocket hiện tại.
  */
  private getSocketUser(client: Socket) {
    const user = client.data.user as SocketUser | undefined;
    if (!user) {
      throw new Error("Kết nối chưa được xác thực");
    }
    return user;
  }

  private parseConversationId(value: unknown) {
    const conversationId = Number(value);
    if (!Number.isInteger(conversationId) || conversationId <= 0) {
      throw new Error("Mã cuộc trò chuyện không hợp lệ");
    }
    return conversationId;
  }

  private userRoom(userId: number) {
    return `user:${userId}`;
  }

  private conversationRoom(conversationId: number) {
    return `conversation:${conversationId}`;
  }

  private getErrorMessage(error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
    ) {
      return error.message;
    }

    return "Không thể xử lý sự kiện realtime";
  }
}
