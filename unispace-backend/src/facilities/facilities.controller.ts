import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { Public } from '../accounts/auth/decorators/public.decorator';
import { FacilityMasterService } from './admin/facility-master.service';
import { FacilityAvailabilityService } from './catalog/facility-availability.service';
import { FacilityCatalogService } from './catalog/facility-catalog.service';
import { QueryAvailabilityDto, QueryFacilitiesDto } from './dto/catalog';

@Controller('facilities')
export class FacilitiesController {
  constructor(
    private readonly master: FacilityMasterService,
    private readonly catalog: FacilityCatalogService,
    private readonly availability: FacilityAvailabilityService,
  ) {}

  /**
   * GET /api/v1/facilities/types
   * Daftar tipe fasilitas untuk dropdown filter katalog.
   * Dapat diakses publik tanpa login.
   */
  @Public()
  @Get('types')
  listTypes() {
    return this.master.listTypes();
  }

  /** Daftar fakultas/area kampus aktif untuk dropdown filter katalog. */
  @Public()
  @Get('areas')
  listAreas() {
    return this.master.listActiveAreas();
  }

  /**
   * GET /api/v1/facilities
   * Katalog fasilitas aktif dengan filter opsional:
   *   - facilityTypeId: filter berdasarkan tipe
   *   - facilityAreaId: filter berdasarkan fakultas/area kampus
   *   - minCapacity: filter kapasitas minimum
   *   - search: pencarian nama atau deskripsi
   *   - page, limit: paginasi (default: page=1, limit=20)
   * Dapat diakses publik tanpa login (FR-FAC-01, FR-FAC-02).
   */
  @Public()
  @Get()
  list(@Query() query: QueryFacilitiesDto) {
    return this.catalog.list(query);
  }

  /**
   * GET /api/v1/facilities/:id/availability
   * Ketersediaan 26 slot 30 menit (07.00–20.00 WIB) per tanggal.
   * Publik tanpa login, tanpa membocorkan identitas pemesan (FR-FAC-04, FR-FAC-05).
   */
  @Public()
  @Get(':id/availability')
  getAvailability(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: QueryAvailabilityDto,
  ) {
    return this.availability.getAvailability(id, query);
  }

  /**
   * GET /api/v1/facilities/:id
   * Detail satu fasilitas untuk publik.
   * Gunakan query ?kind=group untuk melihat detail kelompok alat QUANTITY.
   * Default (tanpa kind) menampilkan unit ruang/area EXCLUSIVE.
   * Tidak menampilkan data identitas atau tujuan pemesan (FR-FAC-03).
   */
  @Public()
  @Get(':id')
  detail(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('kind') kind?: 'unit' | 'group',
  ) {
    return this.catalog.detail(id, kind ?? 'unit');
  }
}
