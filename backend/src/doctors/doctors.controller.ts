import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DoctorsService } from './doctors.service';
import { UpdateDoctorProfileDto } from './dto/update-doctor-profile.dto';

@Controller('doctors')
export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  findMe(@CurrentUser() user: AuthenticatedUser) {
    return this.doctorsService.findMyProfile(user.id);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.doctorsService.findPublicById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_request, file, callback) => {
        if (!/^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype)) {
          callback(
            new BadRequestException(
              'Ảnh phải có định dạng JPG, PNG, WEBP hoặc GIF',
            ),
            false,
          );
          return;
        }

        callback(null, true);
      },
    }),
  )
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateDoctorProfileDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.doctorsService.updateMyProfile(user.id, dto, image);
  }
}
