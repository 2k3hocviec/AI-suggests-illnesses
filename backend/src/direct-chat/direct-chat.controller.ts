import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { AuthenticatedUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateDirectChatRequestDto } from "./dto/create-direct-chat-request.dto";
import { DirectChatGateway } from "./direct-chat.gateway";
import { DirectChatService } from "./direct-chat.service";

@UseGuards(JwtAuthGuard)
@Controller("direct-chat")
export class DirectChatController {
  constructor(
    private readonly directChatService: DirectChatService,
    private readonly directChatGateway: DirectChatGateway,
  ) {}

  @Post("requests")
  async requestConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDirectChatRequestDto,
  ) {
    const result = await this.directChatService.requestConversation(
      user.id,
      dto.doctorId,
      dto.consultationSummary,
    );

    if (result.created) {
      this.directChatGateway.notifyRequestCreated(
        result.doctorUserId,
        result.conversation,
      );
    }

    return {
      created: result.created,
      conversation: result.conversation,
    };
  }

  @Get("conversations")
  listConversations(@CurrentUser() user: AuthenticatedUser) {
    return this.directChatService.listConversations(user.id);
  }

  @Get("conversations/:conversationId/messages")
  listMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId", ParseIntPipe) conversationId: number,
  ) {
    return this.directChatService.listMessages(user.id, conversationId);
  }

  @Patch("conversations/:conversationId/accept")
  async acceptConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId", ParseIntPipe) conversationId: number,
  ) {
    const result = await this.directChatService.acceptConversation(
      user.id,
      conversationId,
    );
    this.directChatGateway.notifyRequestUpdated(
      result.patientId,
      result.conversation,
      true,
    );
    return result.conversation;
  }

  @Patch("conversations/:conversationId/reject")
  async rejectConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId", ParseIntPipe) conversationId: number,
  ) {
    const result = await this.directChatService.rejectConversation(
      user.id,
      conversationId,
    );
    this.directChatGateway.notifyRequestUpdated(
      result.patientId,
      result.conversation,
      false,
    );
    return result.conversation;
  }

  @Patch("conversations/:conversationId/close")
  async closeConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId", ParseIntPipe) conversationId: number,
  ) {
    const result = await this.directChatService.closeConversation(
      user.id,
      conversationId,
    );
    this.directChatGateway.notifyConversationClosed(
      result.recipientId,
      result.conversation,
    );
    return result.conversation;
  }

  @Delete("conversations/:conversationId")
  async deleteConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId", ParseIntPipe) conversationId: number,
  ) {
    const result = await this.directChatService.deleteConversation(
      user.id,
      conversationId,
    );
    this.directChatGateway.notifyConversationClosed(
      result.recipientId,
      result.conversation,
    );
    return result.conversation;
  }

  /*
  Đánh dấu tính nhắn đã đọc
  */
  @Patch("conversations/:conversationId/read")
  async markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId", ParseIntPipe) conversationId: number,
  ) {
    const receipt = await this.directChatService.markRead(
      user.id,
      conversationId,
    );
    this.directChatGateway.emitReadReceipt(conversationId, receipt);
    return receipt;
  }
}
