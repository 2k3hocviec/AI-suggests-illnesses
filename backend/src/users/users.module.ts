import { Module } from '@nestjs/common';
import { AdministrativeUnitsModule } from '../administrative-units/administrative-units.module';
import { AuthModule } from '../auth/auth.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

@Module({
  imports: [AuthModule, AdministrativeUnitsModule, CloudinaryModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
