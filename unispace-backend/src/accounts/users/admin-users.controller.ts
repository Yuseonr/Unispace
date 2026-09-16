import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UserRole } from '../../generated/prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AdminUsersService } from './admin-users.service';
import { CreateManagedUserDto } from './dto/create-managed-user.dto';
import { ListManagedUsersDto } from './dto/list-managed-users.dto';
import { RejectVerificationDto } from './dto/reject-verification.dto';
import { UpdateManagedUserStatusDto } from './dto/update-managed-user-status.dto';

@Controller('admin/users')
@Roles(UserRole.ADMIN)
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  list(@Query() query: ListManagedUsersDto) {
    return this.users.list(query);
  }

  @Get(':userId')
  detail(@Param('userId', new ParseUUIDPipe()) userId: string) {
    return this.users.detail(userId);
  }

  @Post()
  create(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() input: CreateManagedUserDto,
  ) {
    return this.users.create(admin.id, input);
  }

  @Patch(':userId/verify')
  verify(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ) {
    return this.users.verify(admin.id, userId);
  }

  @Patch(':userId/reject')
  reject(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() input: RejectVerificationDto,
  ) {
    return this.users.reject(admin.id, userId, input.reason);
  }

  @Patch(':userId/status')
  updateStatus(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() input: UpdateManagedUserStatusDto,
  ) {
    return this.users.updateStatus(admin.id, userId, input.status);
  }

  @Post(':userId/reset-password')
  resetPassword(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ) {
    return this.users.resetPassword(admin.id, userId);
  }
}
