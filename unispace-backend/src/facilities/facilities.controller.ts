import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { Public } from '../accounts/auth/decorators/public.decorator';
import { QueryAvailabilityDto } from './dto/query-availability.dto';
import { QueryFacilitiesDto } from './dto/query-facilities.dto';
import { FacilitiesService } from './facilities.service';

@Controller('facilities')
export class FacilitiesController {
  constructor(private readonly facilities: FacilitiesService) {}

  /**
   * GET /api/v1/facilities/types
   * Daftar tipe fasilitas untuk dropdown filter katalog.
   * Dapat diakses publik tanpa login.
   */
  @Public()
  @Get('types')
  listTypes() {
    return this.facilities.listTypes();
  }

  /** Daftar fakultas/area kampus aktif untuk dropdown filter katalog. */
  @Public()
  @Get('areas')
  listAreas() {
    return this.facilities.listAreas();
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
    return this.facilities.list(query);
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
    return this.facilities.getAvailability(id, query);
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
    return this.facilities.detail(id, kind ?? 'unit');
  }
}
