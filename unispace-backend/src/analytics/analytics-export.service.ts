import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import svgToPdf from 'svg-to-pdfkit';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AuditLogService } from './audit-log.service';
import { AnalyticsQueryService } from './analytics-query.service';
import {
  AnalyticsExportDto,
  AnalyticsExportFormat,
  AnalyticsExportOrientation,
  AnalyticsExportReport,
  AnalyticsTrendInterval,
  AnalyticsTrendMetric,
} from './dto';
import { PrismaService } from '../database/prisma.service';
import type { Prisma } from '../generated/prisma/client';

type Cell = string | number | null;

type ExportTable = {
  title: string;
  columns: string[];
  rows: Cell[][];
};

type ExportFile = {
  body: Buffer;
  contentType: string;
  filename: string;
  rowCount: number;
  generatedAt: string;
  filters: Record<string, unknown>;
};

const CONTENT_TYPES: Record<AnalyticsExportFormat, string> = {
  [AnalyticsExportFormat.CSV]: 'text/csv; charset=utf-8',
  [AnalyticsExportFormat.XLSX]:
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  [AnalyticsExportFormat.PDF]: 'application/pdf',
};

@Injectable()
export class AnalyticsExportService {
  constructor(
    private readonly analytics: AnalyticsQueryService,
    private readonly auditLogs: AuditLogService,
    private readonly prisma: PrismaService,
  ) {}

  async generate(
    adminId: string,
    input: AnalyticsExportDto,
  ): Promise<ExportFile> {
    const report = await this.reportData(input);
    const table = this.toTable(input.report, report);
    const generatedAt = report.generatedAt as string;
    const filters = report.filters as Record<string, unknown>;
    const extension = input.format;
    const timestamp = generatedAt.replace(/[-:.TZ]/g, '').slice(0, 14);
    const filename = `unispace-${input.report}-${filters.dateFrom as string}_${filters.dateTo as string}-${timestamp}.${extension}`;
    const body = await this.render(input.format, table, {
      filters,
      generatedAt,
      orientation: input.orientation ?? this.defaultOrientation(input.report),
    });
    const exportId = randomUUID();
    await this.prisma.auditLog.create({
      data: {
        id: exportId,
        actorId: adminId,
        action: 'ANALYTICS_EXPORTED',
        entityType: 'ANALYTICS_EXPORT',
        entityId: exportId,
        metadata: {
          dataset: input.report,
          format: input.format,
          filters: this.auditFilterMetadata(filters),
          rowCount: table.rows.length,
          filename,
          generatedAt,
        } as Prisma.InputJsonValue,
      },
    });
    return {
      body,
      contentType: CONTENT_TYPES[input.format],
      filename,
      rowCount: table.rows.length,
      generatedAt,
      filters,
    };
  }

  private async reportData(input: AnalyticsExportDto) {
    switch (input.report) {
      case AnalyticsExportReport.SUMMARY:
        return this.analytics.summary(input);
      case AnalyticsExportReport.OCCUPANCY:
        return this.analytics.occupancy(input);
      case AnalyticsExportReport.EQUIPMENT_UTILIZATION:
        return this.analytics.equipmentUtilization(input);
      case AnalyticsExportReport.DAMAGE_FREQUENCY:
        return this.analytics.damageFrequency(input);
      case AnalyticsExportReport.TRENDS:
        return this.analytics.trends({
          ...input,
          metric: input.metric ?? AnalyticsTrendMetric.OCCUPANCY,
          interval: input.interval ?? AnalyticsTrendInterval.DAY,
        });
      case AnalyticsExportReport.FACILITY_REPORT_HISTORY:
        return this.analytics.facilityReportHistoryForExport(input);
      case AnalyticsExportReport.AUDIT_LOG: {
        const items = await this.auditLogs.listForExport({
          from: input.dateFrom,
          to: input.dateTo,
          page: 1,
          limit: 100,
        });
        return {
          filters: {
            dateFrom: input.dateFrom,
            dateTo: input.dateTo,
            facilityAreaId: null,
            facilityTypeId: null,
            facilityGroupId: null,
            facilityId: null,
            reservationMode: null,
          },
          generatedAt: new Date().toISOString(),
          items,
        };
      }
    }
  }

  private toTable(
    report: AnalyticsExportReport,
    data: Record<string, unknown>,
  ): ExportTable {
    switch (report) {
      case AnalyticsExportReport.SUMMARY:
        return this.summaryTable(data);
      case AnalyticsExportReport.OCCUPANCY:
        return {
          title: 'Okupansi Fasilitas EXCLUSIVE',
          columns: [
            'Kode aset',
            'Fasilitas',
            'Area',
            'Tipe',
            'Status saat ini',
            'Pernah nonaktif',
            'Slot terpakai',
            'Slot tersedia',
            'Okupansi (%)',
          ],
          rows: this.array(data.facilities).map((row) => {
            const item = row as Record<string, unknown>;
            return [
              item.assetCode as string,
              item.name as string,
              this.nameOf(item.facilityArea),
              this.nameOf(item.facilityType),
              item.currentStatus as string,
              item.historicalNonactive ? 'Ya' : 'Tidak',
              item.bookedSlots as number,
              item.availableSlots as number,
              item.percentage as number | null,
            ];
          }),
        };
      case AnalyticsExportReport.EQUIPMENT_UTILIZATION:
        return {
          title: 'Utilisasi Fasilitas QUANTITY',
          columns: [
            'Kelompok fasilitas',
            'Area',
            'Tipe',
            'Total unit',
            'Unit nonaktif saat ini',
            'Pernah nonaktif',
            'Unit-slot terpakai',
            'Unit-slot tersedia',
            'Utilisasi (%)',
          ],
          rows: this.array(data.facilityGroups).map((row) => {
            const item = row as Record<string, unknown>;
            return [
              item.name as string,
              this.nameOf(item.facilityArea),
              this.nameOf(item.facilityType),
              item.totalUnits as number,
              item.currentNonactiveUnits as number,
              item.historicalNonactive ? 'Ya' : 'Tidak',
              item.usedUnitSlots as number,
              item.availableUnitSlots as number,
              item.percentage as number | null,
            ];
          }),
        };
      case AnalyticsExportReport.DAMAGE_FREQUENCY:
        return {
          title: 'Frekuensi Kerusakan per Kategori',
          columns: ['Kategori', 'Jumlah laporan'],
          rows: this.array(data.byCategory).map((row) => {
            const item = row as Record<string, unknown>;
            return [item.label as string, item.count as number];
          }),
        };
      case AnalyticsExportReport.TRENDS:
        return {
          title: `Tren ${String(data.metric)}`,
          columns: [
            'Periode',
            'Numerator',
            'Denominator',
            'Persentase (%)',
            'Jumlah',
          ],
          rows: this.array(data.series).map((row) => {
            const item = row as Record<string, unknown>;
            return [
              item.period as string,
              (item.numerator as number | undefined) ?? null,
              (item.denominator as number | undefined) ?? null,
              (item.percentage as number | undefined) ?? null,
              (item.count as number | undefined) ?? null,
            ];
          }),
        };
      case AnalyticsExportReport.FACILITY_REPORT_HISTORY:
        return {
          title: 'Riwayat Laporan Fasilitas',
          columns: [
            'Nomor laporan',
            'Kategori',
            'Status',
            'Kode aset',
            'Fasilitas',
            'Area',
            'Pelapor',
            'Dibuat',
            'Diterima',
            'Diselesaikan',
            'Durasi resolusi (jam)',
          ],
          rows: this.array(data.items).map((row) => {
            const item = row as Record<string, unknown>;
            const facility = item.facility as Record<string, unknown>;
            return [
              item.reportNumber as string,
              item.categoryLabel as string,
              item.status as string,
              facility.assetCode as string,
              facility.name as string,
              this.nameOf(facility.facilityArea),
              this.nameOf(item.reporter),
              item.createdAt as string,
              item.acceptedAt as string | null,
              item.resolvedAt as string | null,
              item.resolutionHours as number | null,
            ];
          }),
        };
      case AnalyticsExportReport.AUDIT_LOG:
        return {
          title: 'Audit Log Global',
          columns: [
            'Waktu',
            'Aktor',
            'Role aktor',
            'Aksi',
            'Jenis entitas',
            'ID entitas',
            'Metadata',
          ],
          rows: this.array(data.items).map((row) => {
            const item = row as Record<string, unknown>;
            const actor = item.actor as Record<string, unknown> | null;
            return [
              item.createdAt as string,
              actor?.name ? String(actor.name) : 'Sistem',
              actor?.role ? String(actor.role) : null,
              item.action as string,
              item.entityType as string,
              item.entityId as string,
              item.metadata ? JSON.stringify(item.metadata) : null,
            ];
          }),
        };
    }
  }

  private summaryTable(data: Record<string, unknown>): ExportTable {
    const reservations = data.reservations as Record<string, unknown>;
    const reports = data.reports as Record<string, unknown>;
    const facilities = data.facilities as Record<string, unknown>;
    return {
      title: 'Ringkasan Operasional Unispace',
      columns: ['Metrik', 'Nilai'],
      rows: [
        ['Total reservasi', reservations.total as number],
        [
          'Reservasi APPROVED/COMPLETED',
          reservations.approvedOrCompleted as number,
        ],
        ['Total jam terpakai', reservations.totalUsedHours as number],
        [
          'Rata-rata keputusan (jam)',
          this.field(reservations.decisionTimeHours, 'average'),
        ],
        [
          'Median keputusan (jam)',
          this.field(reservations.decisionTimeHours, 'median'),
        ],
        ['Total report', reports.total as number],
        [
          'Report kerusakan terhitung',
          reports.qualifyingDamageReports as number,
        ],
        [
          'Rata-rata resolusi (jam)',
          this.field(reports.resolutionTimeHours, 'average'),
        ],
        ['Total unit fasilitas', facilities.totalUnits as number],
        ['Unit nonaktif saat ini', facilities.currentNonactiveUnits as number],
      ],
    };
  }

  private async render(
    format: AnalyticsExportFormat,
    table: ExportTable,
    metadata: {
      filters: Record<string, unknown>;
      generatedAt: string;
      orientation: AnalyticsExportOrientation;
    },
  ) {
    switch (format) {
      case AnalyticsExportFormat.CSV:
        return this.renderCsv(table);
      case AnalyticsExportFormat.XLSX:
        return this.renderXlsx(table, metadata);
      case AnalyticsExportFormat.PDF:
        return this.renderPdf(table, metadata);
    }
  }

  private renderCsv(table: ExportTable) {
    const escape = (value: Cell) => {
      const text = value === null || value === undefined ? '' : String(value);
      const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
      return /[",\r\n]/.test(safeText)
        ? `"${safeText.replace(/"/g, '""')}"`
        : safeText;
    };
    return Buffer.from(
      `\uFEFF${[table.columns, ...table.rows]
        .map((row) => row.map(escape).join(','))
        .join('\r\n')}\r\n`,
      'utf8',
    );
  }

  private async renderXlsx(
    table: ExportTable,
    metadata: { filters: Record<string, unknown>; generatedAt: string },
  ) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Unispace';
    workbook.created = new Date(metadata.generatedAt);
    const information = workbook.addWorksheet('Metadata');
    information.columns = [{ width: 28 }, { width: 70 }];
    information.addRows([
      ['Dataset', table.title],
      ['Dibuat pada (ISO)', metadata.generatedAt],
      ...Object.entries(metadata.filters).map(([key, value]) => [
        key,
        value ?? 'Semua',
      ]),
    ]);
    information.getRow(1).font = { bold: true };
    const sheet = workbook.addWorksheet('Data');
    sheet.addRow(table.columns);
    table.rows.forEach((row) => sheet.addRow(row));
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: {
        row: Math.max(1, table.rows.length + 1),
        column: table.columns.length,
      },
    };
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0B4B46' },
    };
    sheet.columns.forEach((column, index) => {
      const maxLength = Math.max(
        table.columns[index].length,
        ...table.rows.map((row) => String(row[index] ?? '').length),
      );
      column.width = Math.min(Math.max(maxLength + 2, 12), 45);
    });
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private async renderPdf(
    table: ExportTable,
    metadata: {
      filters: Record<string, unknown>;
      generatedAt: string;
      orientation: AnalyticsExportOrientation;
    },
  ) {
    const document = new PDFDocument({
      size: 'A4',
      layout: metadata.orientation,
      margin: 36,
      info: { Title: table.title, Author: 'Unispace' },
    });
    const buffers: Buffer[] = [];
    document.on('data', (chunk: Buffer) => buffers.push(chunk));
    const completion = new Promise<Buffer>((resolve, reject) => {
      document.on('end', () => resolve(Buffer.concat(buffers)));
      document.on('error', reject);
    });
    const logo = await this.readLogo();
    let page = 1;
    const header = () => {
      svgToPdf(document, logo, 36, 30, { width: 28, height: 30 });
      document.fillColor('#0B4B46').fontSize(15).text(table.title, 72, 34);
      document
        .fillColor('#333333')
        .fontSize(8)
        .text(`Filter: ${this.filterText(metadata.filters)}`, 36, 72, {
          width: document.page.width - 72,
        })
        .text(`Dibuat: ${this.formatJakarta(metadata.generatedAt)}`, 36, 84, {
          width: document.page.width - 72,
        });
      return 108;
    };
    const footer = () => {
      document
        .fillColor('#666666')
        .fontSize(8)
        .text(`Unispace • Halaman ${page}`, 36, document.page.height - 30, {
          width: document.page.width - 72,
          align: 'right',
        });
    };
    let y = header();
    const width = (document.page.width - 72) / table.columns.length;
    const drawTableHeader = () => {
      document
        .fillColor('#0B4B46')
        .rect(36, y, document.page.width - 72, 18)
        .fill();
      document.fillColor('#FFFFFF').fontSize(7);
      table.columns.forEach((column, index) => {
        document.text(column, 38 + index * width, y + 5, {
          width: width - 4,
          height: 11,
          ellipsis: true,
        });
      });
      y += 20;
    };
    drawTableHeader();
    table.rows.forEach((row, rowIndex) => {
      const rowHeight = 22;
      if (y + rowHeight > document.page.height - 42) {
        footer();
        document.addPage();
        page += 1;
        y = header();
        drawTableHeader();
      }
      if (rowIndex % 2 === 1) {
        document
          .fillColor('#F4F7F6')
          .rect(36, y, document.page.width - 72, rowHeight)
          .fill();
      }
      document.fillColor('#222222').fontSize(7);
      row.forEach((cell, index) => {
        document.text(this.pdfCell(cell), 38 + index * width, y + 5, {
          width: width - 4,
          height: rowHeight - 6,
          ellipsis: true,
        });
      });
      y += rowHeight;
    });
    footer();
    document.end();
    return completion;
  }

  private array(value: unknown) {
    return Array.isArray(value) ? value : [];
  }

  private nameOf(value: unknown) {
    return value && typeof value === 'object' && 'name' in value
      ? String((value as { name: unknown }).name)
      : '';
  }

  private field(value: unknown, field: string): Cell {
    return value && typeof value === 'object' && field in value
      ? ((value as Record<string, Cell>)[field] ?? null)
      : null;
  }

  private defaultOrientation(report: AnalyticsExportReport) {
    return [
      AnalyticsExportReport.OCCUPANCY,
      AnalyticsExportReport.EQUIPMENT_UTILIZATION,
      AnalyticsExportReport.FACILITY_REPORT_HISTORY,
      AnalyticsExportReport.AUDIT_LOG,
    ].includes(report)
      ? AnalyticsExportOrientation.LANDSCAPE
      : AnalyticsExportOrientation.PORTRAIT;
  }

  private filterText(filters: Record<string, unknown>) {
    return Object.entries(filters)
      .filter(([, value]) => value !== null)
      .map(([key, value]) => `${key}=${String(value)}`)
      .join(' • ');
  }

  private auditFilterMetadata(filters: Record<string, unknown>) {
    return Object.fromEntries(
      Object.entries(filters).map(([key, value]) => [
        key,
        value === null || typeof value === 'string' ? value : String(value),
      ]),
    ) as Prisma.InputJsonObject;
  }

  private formatJakarta(value: string) {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'medium',
      timeZone: 'Asia/Jakarta',
    }).format(new Date(value));
  }

  private pdfCell(value: Cell) {
    return value === null || value === undefined ? '—' : String(value);
  }

  private async readLogo() {
    const paths = [
      join(process.cwd(), 'dist', 'analytics', 'assets', 'unispace-logo.svg'),
      join(process.cwd(), 'src', 'analytics', 'assets', 'unispace-logo.svg'),
    ];
    let lastError: unknown;
    for (const path of paths) {
      try {
        return await readFile(path, 'utf8');
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }
}
