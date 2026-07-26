import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
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
  createDoctorAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDoctorAccountDto,
  ) {
    return this.usersService.createDoctorAccount(user.id, dto);
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
