import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { SearchReportFacilitiesDto } from './dto/search-report-facilities.dto';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('facilities')
  searchFacilities(@Query() query: SearchReportFacilitiesDto) {
    return this.reports.searchFacilities(query);
  }
}
