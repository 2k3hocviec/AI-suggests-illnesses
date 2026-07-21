import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { ChatController, GuestChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [ChatController, GuestChatController],
  providers: [ChatService],
})
export class ChatModule {}
