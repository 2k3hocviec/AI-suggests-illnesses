import { Module } from '@nestjs/common';
import { AdministrativeUnitsModule } from '../administrative-units/administrative-units.module';
import { AuthModule } from '../auth/auth.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { DoctorsController } from './doctors.controller';
import { DoctorsService } from './doctors.service';

@Module({
  imports: [AuthModule, AdministrativeUnitsModule, CloudinaryModule],
  controllers: [DoctorsController],
  providers: [DoctorsService],
  exports: [DoctorsService],
})
export class DoctorsModule {}
