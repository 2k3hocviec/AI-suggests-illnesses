import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/auth.types';
import { ChatService } from './chat.service';
import { SendChatMessageDto } from './dto/send-chat-message.dto';
import { UsersService } from '../users/users.service';

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly usersService: UsersService,
  ) {}

  @Post('messages')
  sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendChatMessageDto,
  ) {
    return this.chatService.sendMessage(user.id, dto);
  }

  @Get('sessions')
  listSessions(@CurrentUser() user: AuthenticatedUser) {
    return this.chatService.listSessions(user.id);
  }

  @Get('sessions/:sessionId/messages')
  listMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseIntPipe) sessionId: number,
  ) {
    return this.chatService.listMessages(user.id, sessionId);
  }

  @Post('admin/model-test')
  async testModel(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendChatMessageDto,
  ) {
    await this.usersService.assertAdmin(user.id);

    return this.chatService.testModel(dto.message);
  }
}

@Controller('chat')
export class GuestChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('guest-messages')
  sendGuestMessage(@Body() dto: SendChatMessageDto) {
    return this.chatService.sendGuestMessage(dto);
  }
}
