import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { Public } from '../accounts/auth/decorators/public.decorator';
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

  /**
   * GET /api/v1/facilities/locations
   * Daftar lokasi/gedung untuk dropdown filter katalog.
   * Dapat diakses publik tanpa login.
   */
  @Public()
  @Get('locations')
  listLocations() {
    return this.facilities.listLocations();
  }

  /**
   * GET /api/v1/facilities
   * Katalog fasilitas aktif dengan filter opsional:
   *   - facilityTypeId: filter berdasarkan tipe
   *   - locationId: filter berdasarkan lokasi/gedung
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
