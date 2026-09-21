import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { UserRole } from '../generated/prisma/client';
import { CurrentUser } from '../accounts/auth/decorators/current-user.decorator';
import { Roles } from '../accounts/auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../accounts/auth/auth.types';
import { CreateFacilityGroupDto } from './dto/create-facility-group.dto';
import { CreateFacilityUnitDto } from './dto/create-facility-unit.dto';
import { UpdateFacilityGroupDto } from './dto/update-facility-group.dto';
import { FacilitiesService } from './facilities.service';

@Controller('admin/facilities')
@Roles(UserRole.ADMIN)
export class AdminFacilitiesController {
  constructor(private readonly facilities: FacilitiesService) {}

  /**
   * GET /api/v1/admin/facilities
   * Daftar seluruh kelompok fasilitas beserta unit fisiknya (termasuk yang nonaktif).
   */
  @Get()
  list() {
    return this.facilities.adminList();
  }

  /**
   * POST /api/v1/admin/facilities/groups
   * Membuat kelompok fasilitas baru (EXCLUSIVE atau QUANTITY) dengan foto utama wajib.
   */
  @Post('groups')
  createGroup(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() input: CreateFacilityGroupDto,
  ) {
    return this.facilities.adminCreateGroup(admin.id, input);
  }

  /**
   * PATCH /api/v1/admin/facilities/groups/:id
   * Memperbarui metadata kelompok fasilitas (nama, tipe, lokasi, foto utama, dsb).
   */
  @Patch('groups/:id')
  updateGroup(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: UpdateFacilityGroupDto,
  ) {
    return this.facilities.adminUpdateGroup(admin.id, id, input);
  }

  /**
   * POST /api/v1/admin/facilities/units
   * Menambahkan unit fisik baru dengan assetCode unik ke dalam kelompok fasilitas.
   */
  @Post('units')
  createUnit(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() input: CreateFacilityUnitDto,
  ) {
    return this.facilities.adminCreateUnit(admin.id, input);
  }
}
