import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DirectChatController } from './direct-chat.controller';
import { DirectChatGateway } from './direct-chat.gateway';
import { DirectChatService } from './direct-chat.service';

@Module({
  imports: [AuthModule],
  controllers: [DirectChatController],
  providers: [DirectChatService, DirectChatGateway],
})
export class DirectChatModule {}
