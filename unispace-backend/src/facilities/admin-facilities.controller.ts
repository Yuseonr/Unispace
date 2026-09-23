import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { UserRole } from '../generated/prisma/client';
import { CurrentUser } from '../accounts/auth/decorators/current-user.decorator';
import { Roles } from '../accounts/auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../accounts/auth/auth.types';
import { FacilityManagementService } from './admin/facility-management.service';
import { FacilityMasterService } from './admin/facility-master.service';
import { FacilityStatusService } from './admin/facility-status.service';
import {
  CreateFacilityAreaDto,
  CreateFacilityGroupDto,
  CreateFacilityTypeDto,
  CreateFacilityUnitDto,
  UpdateFacilityAreaDto,
  UpdateFacilityAreaStatusDto,
  UpdateFacilityGroupDto,
  UpdateFacilityStatusDto,
  UpdateFacilityTypeDto,
  UpdateFacilityUnitDto,
} from './dto/admin';
import type { FacilityImageUpload } from './facility-image-storage.service';
import { FacilityImageUploadInterceptor } from './facility-image-upload.interceptor';

@Controller('admin/facilities')
@Roles(UserRole.ADMIN)
export class AdminFacilitiesController {
  constructor(
    private readonly master: FacilityMasterService,
    private readonly management: FacilityManagementService,
    private readonly status: FacilityStatusService,
  ) {}

  /**
   * GET /api/v1/admin/facilities
   * Daftar seluruh kelompok fasilitas beserta unit fisiknya (termasuk yang nonaktif).
   */
  @Get()
  list() {
    return this.management.adminList();
  }

  /**
   * POST /api/v1/admin/facilities/groups
   * Membuat kelompok fasilitas baru (EXCLUSIVE atau QUANTITY) dengan foto utama wajib.
   */
  @Post('groups')
  @UseInterceptors(FacilityImageUploadInterceptor)
  createGroup(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() input: CreateFacilityGroupDto,
    @UploadedFile() primaryImage?: FacilityImageUpload,
  ) {
    return this.management.adminCreateGroup(admin.id, input, primaryImage);
  }

  /**
   * PATCH /api/v1/admin/facilities/groups/:id
   * Memperbarui metadata kelompok fasilitas (nama, area, lokasi detail, foto utama, dsb).
   */
  @Patch('groups/:id')
  @UseInterceptors(FacilityImageUploadInterceptor)
  updateGroup(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: UpdateFacilityGroupDto,
    @UploadedFile() primaryImage?: FacilityImageUpload,
  ) {
    return this.management.adminUpdateGroup(admin.id, id, input, primaryImage);
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
    return this.management.adminCreateUnit(admin.id, input);
  }

  /** Memperbarui kode aset atau metadata unit EXCLUSIVE. */
  @Patch('units/:id')
  @UseInterceptors(FacilityImageUploadInterceptor)
  updateUnit(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: UpdateFacilityUnitDto,
    @UploadedFile() primaryImage?: FacilityImageUpload,
  ) {
    return this.management.adminUpdateUnit(admin.id, id, input, primaryImage);
  }

  /**
   * PATCH /api/v1/admin/facilities/units/:id/status
   * Mengubah status unit fasilitas (ACTIVE / NONACTIVE).
   * Ditolak jika ada reservasi APPROVED yang belum selesai (FR-FAC-07).
   */
  @Patch('units/:id/status')
  updateUnitStatus(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: UpdateFacilityStatusDto,
  ) {
    return this.status.adminUpdateUnitStatus(admin.id, id, input.status);
  }

  /** Master tipe fasilitas untuk form admin dan filter katalog. */
  @Get('types')
  listTypes() {
    return this.master.adminListTypes();
  }

  @Post('types')
  createType(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() input: CreateFacilityTypeDto,
  ) {
    return this.master.adminCreateType(admin.id, input);
  }

  @Patch('types/:id')
  updateType(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: UpdateFacilityTypeDto,
  ) {
    return this.master.adminUpdateType(admin.id, id, input);
  }

  /** Master area kampus. Tidak ada delete fisik untuk menjaga relasi katalog. */
  @Get('areas')
  listAreas() {
    return this.master.adminListAreas();
  }

  @Post('areas')
  createArea(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() input: CreateFacilityAreaDto,
  ) {
    return this.master.adminCreateArea(admin.id, input);
  }

  @Patch('areas/:id')
  updateArea(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: UpdateFacilityAreaDto,
  ) {
    return this.master.adminUpdateArea(admin.id, id, input);
  }

  @Patch('areas/:id/status')
  updateAreaStatus(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: UpdateFacilityAreaStatusDto,
  ) {
    return this.master.adminUpdateAreaStatus(admin.id, id, input.status);
  }
}
