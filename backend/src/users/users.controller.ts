import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';
import { CreateDoctorAccountDto } from './dto/create-doctor-account.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('admin/doctor-options')
  getDoctorCreationOptions(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getDoctorCreationOptions(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('admin/doctors')
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
  createDoctorAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDoctorAccountDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.usersService.createDoctorAccount(user.id, dto, image);
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/overview')
  getAdminOverview(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.usersService.getAdminOverview(user.id, { from, to });
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin')
  listAdminUsers(
    @CurrentUser() user: AuthenticatedUser,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.usersService.listUsersForAdmin(user.id, {
      search,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Patch('admin/:id/status')
  setUserEnabled(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { isEnabled: boolean },
  ) {
    return this.usersService.setUserEnabled(user.id, id, body.isEnabled);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findById(id);
  }
}
