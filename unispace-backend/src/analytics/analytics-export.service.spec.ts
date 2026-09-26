import ExcelJS from 'exceljs';
import { jest } from '@jest/globals';
import type { PrismaService } from '../database/prisma.service';
import { AnalyticsExportService } from './analytics-export.service';
import type { AnalyticsQueryService } from './analytics-query.service';
import type { AuditLogService } from './audit-log.service';
import {
  AnalyticsExportFormat,
  AnalyticsExportReport,
} from './dto/analytics-export.dto';

const summary = {
  filters: {
    dateFrom: '2026-01-01',
    dateTo: '2026-01-31',
    facilityAreaId: null,
    facilityTypeId: null,
    facilityGroupId: null,
    facilityId: null,
    reservationMode: null,
  },
  generatedAt: '2026-01-31T10:00:00.000Z',
  reservations: {
    total: 4,
    approvedOrCompleted: 2,
    totalUsedHours: 3.5,
    decisionTimeHours: { average: 1.5, median: 1.5 },
  },
  reports: {
    total: 3,
    qualifyingDamageReports: 2,
    resolutionTimeHours: { average: 4, median: 4 },
  },
  facilities: {
    totalUnits: 5,
    currentNonactiveUnits: 1,
  },
};

describe('AnalyticsExportService', () => {
  let service: AnalyticsExportService;
  let auditCreate: jest.Mock;

  beforeEach(() => {
    auditCreate = jest.fn().mockResolvedValue({});
    service = new AnalyticsExportService(
      {
        summary: jest.fn().mockResolvedValue(summary),
      } as unknown as AnalyticsQueryService,
      { listForExport: jest.fn() } as unknown as AuditLogService,
      { auditLog: { create: auditCreate } } as unknown as PrismaService,
    );
  });

  const request = (format: AnalyticsExportFormat) => ({
    dateFrom: '2026-01-01',
    dateTo: '2026-01-31',
    report: AnalyticsExportReport.SUMMARY,
    format,
  });

  it('menghasilkan CSV BOM dengan escaping RFC 4180 dan mitigasi formula', async () => {
    const csv = (
      service as unknown as {
        renderCsv: (table: {
          columns: string[];
          rows: Array<Array<string | number | null>>;
        }) => Buffer;
      }
    ).renderCsv({
      columns: ['Kolom, satu', 'Nilai'],
      rows: [['=SUM(A1:A2)', 'teks "berkutip"']],
    });

    expect(csv.toString('utf8')).toBe(
      '\uFEFF"Kolom, satu",Nilai\r\n\'=SUM(A1:A2),"teks ""berkutip"""\r\n',
    );
  });

  it('menghasilkan workbook XLSX dengan sheet metadata dan data', async () => {
    const result = await service.generate(
      'admin-1',
      request(AnalyticsExportFormat.XLSX),
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(result.body);

    expect(result.contentType).toContain('spreadsheetml');
    expect(result.filename).toMatch(
      /^unispace-summary-2026-01-01_2026-01-31-\d{14}\.xlsx$/,
    );
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      'Metadata',
      'Data',
    ]);
    expect(workbook.getWorksheet('Data')?.getCell('A1').value).toBe('Metrik');
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'ANALYTICS_EXPORTED' }),
    });
  });

  it('menghasilkan PDF dengan signature valid dan mengaudit export setelah render berhasil', async () => {
    const result = await service.generate(
      'admin-1',
      request(AnalyticsExportFormat.PDF),
    );

    expect(result.contentType).toBe('application/pdf');
    expect(result.body.subarray(0, 4).toString('ascii')).toBe('%PDF');
    expect(auditCreate).toHaveBeenCalledTimes(1);
  });
});
