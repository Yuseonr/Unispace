import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import SVGtoPDF from 'svg-to-pdfkit';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AuditLogService } from './audit-log.service';
import { AnalyticsQueryService } from './analytics-query.service';
import {
  AnalyticsExportDto,
  AnalyticsExportFormat,
  AnalyticsExportReport,
  AnalyticsTrendInterval,
  AnalyticsTrendMetric,
} from './dto';
import { PrismaService } from '../database/prisma.service';
import type { Prisma } from '../generated/prisma/client';

type Cell = string | number | null;

type ExportSection = {
  title: string;
  columns: string[];
  rows: Cell[][];
  pdfColumns?: string[];
  pdfRows?: Cell[][];
  pdfColumnFractions?: number[];
};

type ExportTable = ExportSection & {
  sections?: ExportSection[];
  reportRecords?: ReportExportRecord[];
};

type ReportExportRecord = {
  reportNumber: string;
  category: string;
  status: string;
  statusLabel: string;
  assetCode: string;
  facilityName: string;
  groupName: string;
  area: string;
  type: string;
  mode: string;
  reporter: string;
  createdAt: string;
  acceptedAt: string | null;
  acceptedBy: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionHours: number | null;
  description: string;
  attachments: string[];
  decisionReason: string | null;
  resolutionNote: string | null;
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
    const displayFilters = await this.describeFilters(filters);
    const rowCount = table.sections
      ? table.sections.reduce((total, section) => total + section.rows.length, 0)
      : table.rows.length;
    const extension = input.format;
    const timestamp = generatedAt.replace(/[-:.TZ]/g, '').slice(0, 14);
    const filename = `unispace-${input.report}-${filters.dateFrom as string}_${filters.dateTo as string}-${timestamp}.${extension}`;
    const body = await this.render(input.format, table, {
      filters: displayFilters,
      generatedAt,
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
          rowCount,
          filename,
          generatedAt,
        } as Prisma.InputJsonValue,
      },
    });
    return {
      body,
      contentType: CONTENT_TYPES[input.format],
      filename,
      rowCount,
      generatedAt,
      filters,
    };
  }

  private async reportData(input: AnalyticsExportDto) {
    switch (input.report) {
      case AnalyticsExportReport.SUMMARY: {
        return this.analytics.summaryForExport(input);
      }
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
          'Kapasitas unit-slot pada periode',
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
      case AnalyticsExportReport.FACILITY_REPORT_HISTORY: {
        return this.reportHistoryTable(this.array(data.items));
      }
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
    const summary = this.object(data.summary);
    const reservationMetrics = this.object(summary.reservations);
    const reports = this.object(summary.reports);
    const facilities = this.object(summary.facilities);
    const occupancy = this.object(data.occupancy);
    const equipment = this.object(data.equipment);
    const reservationHistory = this.object(data.reservations);
    const reportHistory = this.object(data.reportHistory);
    const occupancyFacilities = this.array(occupancy.facilities).map((value) =>
      this.object(value),
    );
    const equipmentGroups = this.array(equipment.facilityGroups).map((value) =>
      this.object(value),
    );
    const reservationStatusRows = Object.entries(
      this.object(reservationMetrics.byStatus),
    ).map(([status, count]) => [
      'Reservasi ' + this.reservationStatusLabel(status),
      count as number,
    ] as Cell[]);
    const reportStatusRows = Object.entries(this.object(reports.byStatus)).map(
      ([status, count]) => [
        'Laporan ' + this.reportStatusLabel(status),
        count as number,
      ] as Cell[],
    );
    const equipmentTotalUnits = equipmentGroups.reduce(
      (total, group) => total + Number(group.totalUnits ?? 0),
      0,
    );
    const equipmentInactiveUnits = equipmentGroups.reduce(
      (total, group) => total + Number(group.currentNonactiveUnits ?? 0),
      0,
    );
    const metrics: ExportSection = {
      title: 'Ringkasan operasional',
      columns: ['Metrik', 'Nilai'],
      rows: [
        ['Total reservasi', reservationMetrics.total as number],
        [
          'Reservasi disetujui atau selesai',
          reservationMetrics.approvedOrCompleted as number,
        ],
        ['Total jam penggunaan', reservationMetrics.totalUsedHours as number],
        [
          'Rata-rata waktu keputusan (jam)',
          this.field(reservationMetrics.decisionTimeHours, 'average'),
        ],
        [
          'Median waktu keputusan (jam)',
          this.field(reservationMetrics.decisionTimeHours, 'median'),
        ],
        ['Total laporan fasilitas', reports.total as number],
        [
          'Laporan kerusakan terhitung',
          reports.qualifyingDamageReports as number,
        ],
        [
          'Rata-rata waktu penyelesaian (jam)',
          this.field(reports.resolutionTimeHours, 'average'),
        ],
        ['Total unit fasilitas', facilities.totalUnits as number],
        ['Unit nonaktif saat ini', facilities.currentNonactiveUnits as number],
        ['Unit pernah nonaktif pada periode', facilities.historicalNonactiveUnits as number],
        ['Fasilitas ruang', occupancyFacilities.length],
        ['Slot ruang terpakai', occupancy.bookedSlots as number],
        ['Kapasitas slot ruang pada periode', occupancy.availableSlots as number],
        ['Okupansi ruang (%)', this.percentageCell(occupancy.percentage)],
        ['Kelompok alat', equipmentGroups.length],
        ['Total unit alat', equipmentTotalUnits],
        ['Unit alat nonaktif saat ini', equipmentInactiveUnits],
        [
          'Kelompok alat pernah nonaktif pada periode',
          equipmentGroups.filter((group) => Boolean(group.historicalNonactive)).length,
        ],
        ['Unit-slot alat terpakai', equipment.usedUnitSlots as number],
        ['Kapasitas unit-slot alat pada periode', equipment.availableUnitSlots as number],
        ['Utilisasi alat (%)', this.percentageCell(equipment.percentage)],
        ...reservationStatusRows,
        ...reportStatusRows,
      ],
      pdfColumnFractions: [0.74, 0.26],
    };
    const reservationSection: ExportSection = {
      title: 'Seluruh reservasi',
      columns: [
        'Nomor reservasi',
        'Tanggal penggunaan',
        'Jam mulai',
        'Jam selesai',
        'Waktu pengajuan',
        'Waktu keputusan',
        'Waktu pembatalan',
        'Pemohon',
        'Kelompok fasilitas',
        'Fasilitas ruang',
        'Alat / unit dialokasikan',
        'Area',
        'Tipe',
        'Mode fasilitas',
        'Jumlah diminta',
        'Tujuan',
        'Status',
        'Diproses oleh',
        'Alasan keputusan',
      ],
      rows: this.array(reservationHistory.items).map((value) => {
        const item = this.object(value);
        const itemCodes = this.array(item.items).filter(
          (code): code is string => typeof code === 'string',
        );
        const area = this.object(item.facilityArea);
        return [
          item.reservationNumber as string,
          item.usageDate as string,
          item.startTime as string,
          item.endTime as string,
          item.createdAt as string,
          item.decidedAt as string | null,
          item.cancelledAt as string | null,
          item.requester as string,
          item.facilityGroup as string,
          item.facility as string,
          itemCodes.join('\n'),
          [area.code, area.name].filter(Boolean).join(' / '),
          item.facilityType as string,
          item.reservationMode === 'EXCLUSIVE'
            ? 'Ruang / area'
            : item.reservationMode === 'QUANTITY'
              ? 'Alat'
              : 'Tidak diketahui',
          item.quantity as number,
          item.purpose as string,
          this.reservationStatusLabel(String(item.status)),
          item.processedBy as string | null,
          item.decisionReason as string | null,
        ];
      }),
    };
    reservationSection.pdfColumns = [
      'No.',
      'Reservasi dan jadwal',
      'Pemohon',
      'Fasilitas, alat, dan tujuan',
      'Status dan keterangan',
      'Jumlah',
    ];
    reservationSection.pdfRows = reservationSection.rows.map((row, index) => [
      index + 1,
      [row[0], row[1], row[2], row[3], 'Diajukan ' + String(row[4] ?? '')]
        .map((value) => String(value ?? ''))
        .filter(Boolean)
        .join('\n'),
      row[7],
      [
        row[8],
        row[9],
        row[10],
        [row[11], row[12], row[13]].filter(Boolean).join(' / '),
        row[15],
      ]
        .map((value) => String(value ?? ''))
        .filter(Boolean)
        .join('\n'),
      [row[16], row[18], row[5], row[6], row[17]]
        .map((value) => String(value ?? ''))
        .filter(Boolean)
        .join('\n'),
      row[14],
    ]);
    reservationSection.pdfColumnFractions = [0.05, 0.20, 0.12, 0.24, 0.31, 0.08];
    const occupancySection: ExportSection = {
      title: 'Detail okupansi ruang',
      columns: [
        'Kode aset',
        'Fasilitas',
        'Kelompok fasilitas',
        'Area',
        'Tipe',
        'Status saat ini',
        'Pernah nonaktif',
        'Slot terpakai',
        'Kapasitas slot pada periode',
        'Okupansi (%)',
      ],
      rows: occupancyFacilities.map((item) => {
        return [
          item.assetCode as string,
          item.name as string,
          item.facilityGroupName as string,
          this.nameOf(item.facilityArea),
          this.nameOf(item.facilityType),
          this.facilityStatusLabel(String(item.currentStatus)),
          item.historicalNonactive ? 'Ya' : 'Tidak',
          item.bookedSlots as number,
          item.availableSlots as number,
          item.percentage as number | null,
        ];
      }),
    };
    occupancySection.pdfColumns = [
      'Fasilitas',
      'Kelompok / area / tipe / status',
      'Slot terpakai',
      'Kapasitas periode',
      'Okupansi (%)',
    ];
    occupancySection.pdfRows = occupancySection.rows.map((row) => [
      String(row[0] ?? '') + '\n' + String(row[1] ?? ''),
      [row[2], row[3], row[4], 'Status ' + String(row[5] ?? '')]
        .filter(Boolean)
        .join('\n'),
      row[7],
      row[8],
      row[9],
    ]);
    occupancySection.pdfColumnFractions = [0.24, 0.26, 0.15, 0.17, 0.18];
    const equipmentSection: ExportSection = {
      title: 'Detail utilisasi alat',
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
      rows: equipmentGroups.map((item) => {
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
    equipmentSection.pdfColumns = [
      'Kelompok alat',
      'Area / tipe',
      'Unit total / nonaktif',
      'Unit-slot terpakai',
      'Kapasitas unit-slot pada periode',
      'Utilisasi (%)',
    ];
    equipmentSection.pdfRows = equipmentSection.rows.map((row) => [
      row[0],
      [row[1], row[2]].filter(Boolean).join('\n'),
      String(row[3] ?? '') + ' / ' + String(row[4] ?? '') + ' nonaktif',
      row[6],
      row[7],
      typeof row[8] === 'number' ? row[8].toFixed(1) + '%' : 'Tidak tersedia',
    ]);
    equipmentSection.pdfColumnFractions = [0.22, 0.18, 0.18, 0.15, 0.15, 0.12];
    const reportSection = this.reportHistoryTable(
      this.array(reportHistory.items),
    );
    return {
      title: 'Rekap Operasional Unispace',
      columns: metrics.columns,
      rows: metrics.rows,
      sections: [
        metrics,
        reservationSection,
        occupancySection,
        equipmentSection,
        {
          ...reportSection,
          title: 'Detail laporan fasilitas',
        },
      ],
    };
  }

  private reportHistoryTable(items: unknown[]): ExportTable {
    const reportRecords = items.map((value) => this.toReportExportRecord(value));
    const section: ExportSection = {
      title: 'Rekap Laporan Fasilitas',
      columns: [
        'Nomor laporan',
        'Kategori',
        'Status',
        'Kode aset',
        'Fasilitas',
        'Kelompok fasilitas',
        'Area',
        'Tipe',
        'Mode fasilitas',
        'Pelapor',
        'Waktu laporan',
        'Deskripsi kendala',
        'Alasan keputusan',
        'Diterima pada',
        'Diterima oleh',
        'Diselesaikan pada',
        'Diselesaikan oleh',
        'Waktu penyelesaian (jam)',
        'Catatan penyelesaian',
        'Lampiran',
      ],
      rows: reportRecords.map((item) => [
        item.reportNumber,
        item.category,
        item.statusLabel,
        item.assetCode,
        item.facilityName,
        item.groupName,
        item.area,
        item.type,
        item.mode,
        item.reporter,
        item.createdAt,
        item.description,
        item.decisionReason,
        item.acceptedAt,
        item.acceptedBy,
        item.resolvedAt,
        item.resolvedBy,
        item.resolutionHours,
        item.resolutionNote,
        item.attachments.join('\n'),
      ]),
      pdfColumns: [
        'No.',
        'Laporan / tanggal',
        'Fasilitas / kategori',
        'Pelapor',
        'Status / proses',
        'Deskripsi / catatan',
      ],
      pdfRows: reportRecords.map((item, index) => [
        index + 1,
        item.reportNumber + '\n' + item.createdAt,
        [item.assetCode, item.facilityName, item.category]
          .filter(Boolean)
          .join('\n'),
        item.reporter,
        [
          item.statusLabel,
          item.acceptedAt ? 'Diterima ' + item.acceptedAt : null,
          item.acceptedBy ? 'Petugas ' + item.acceptedBy : null,
          item.resolvedAt ? 'Selesai ' + item.resolvedAt : null,
          item.resolvedBy ? 'Diselesaikan oleh ' + item.resolvedBy : null,
          item.resolutionHours !== null
            ? 'Durasi ' + item.resolutionHours + ' jam'
            : null,
          item.decisionReason,
        ]
          .filter(Boolean)
          .join('\n'),
        [
          item.description,
          item.resolutionNote ? 'Catatan: ' + item.resolutionNote : null,
          item.attachments.length
            ? 'Lampiran: ' + item.attachments.join(', ')
            : null,
        ]
          .filter(Boolean)
          .join('\n'),
      ]),
      pdfColumnFractions: [0.05, 0.17, 0.22, 0.15, 0.17, 0.24],
    };
    return {
      ...section,
      reportRecords,
    };
  }

  private async render(
    format: AnalyticsExportFormat,
    table: ExportTable,
    metadata: { filters: Record<string, unknown>; generatedAt: string },
  ) {
    switch (format) {
      case AnalyticsExportFormat.CSV:
        return this.renderCsv(table, metadata);
      case AnalyticsExportFormat.XLSX:
        return this.renderXlsx(table, metadata);
      case AnalyticsExportFormat.PDF:
        return table.reportRecords
          ? this.renderReportHistoryPdf(table, metadata)
          : this.renderPdf(table, metadata);
    }
  }

  private renderCsv(
    table: ExportTable,
    metadata: { filters: Record<string, unknown>; generatedAt: string },
  ) {
    const escape = (value: Cell) => {
      const text = value === null || value === undefined ? '' : String(value);
      const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
      return /[",\r\n]/.test(safeText)
        ? `"${safeText.replace(/"/g, '""')}"`
        : safeText;
    };
    const sections = table.sections;
    const sectionRows = sections
      ? sections.flatMap((section, index) => [
          ...(index > 0 ? [Array(section.columns.length).fill('')] : []),
          [section.title, ...Array(Math.max(0, section.columns.length - 1)).fill('')],
          section.columns,
          ...section.rows,
        ])
      : [table.columns, ...table.rows];
    const rows = [
      ['Laporan', table.title],
      ['Dibuat pada', this.formatJakarta(metadata.generatedAt)],
      ...Object.entries(metadata.filters),
      [],
      ...sectionRows,
    ];
    return Buffer.from(
      `\uFEFF${rows
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
    const sections = table.sections?.length
      ? table.sections
      : [{ title: 'Data', columns: table.columns, rows: table.rows }];
    sections.forEach((section) => {
      const sheet = workbook.addWorksheet(section.title.slice(0, 31));
      sheet.addRow(section.columns);
      section.rows.forEach((row) => sheet.addRow(row));
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: {
          row: Math.max(1, section.rows.length + 1),
          column: section.columns.length,
        },
      };
      sheet.getRow(1).height = 28;
      sheet.getRow(1).font = { bold: true, color: { argb: 'FF111111' } };
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE6E6E6' },
      };
      sheet.getRow(1).alignment = { vertical: 'middle', wrapText: true };
      sheet.getRow(1).border = {
        bottom: { style: 'medium', color: { argb: 'FF555555' } },
      };
      const columnWidths = section.columns.map((_, index) => {
        const maxLength = Math.max(
          section.columns[index].length,
          ...section.rows.map((row) => String(row[index] ?? '').length),
        );
        return Math.min(Math.max(maxLength + 2, 12), 45);
      });
      sheet.columns.forEach((column, index) => {
        column.width = columnWidths[index];
        if (section.columns[index].includes('(%)')) {
          column.numFmt = '0.0"%"';
        }
      });
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        row.alignment = { vertical: 'top', wrapText: true };
        row.border = {
          bottom: { style: 'hair', color: { argb: 'FFB8B8B8' } },
        };
        if (rowNumber % 2 === 1) {
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF5F5F5' },
          };
        }
        let visualLines = 1;
        row.eachCell((cell, columnNumber) => {
          const width = Math.max(8, columnWidths[columnNumber - 1] - 2);
          const lines = String(cell.value ?? '').split(/\r?\n/).reduce(
            (total, line) => total + Math.max(1, Math.ceil(line.length / width)),
            0,
          );
          visualLines = Math.max(visualLines, lines);
        });
        row.height = Math.min(400, Math.max(22, visualLines * 14 + 8));
      });
    });
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private async renderReportHistoryPdf(
    table: ExportTable,
    metadata: { filters: Record<string, unknown>; generatedAt: string },
  ) {
    const records = table.reportRecords ?? [];
    const document = new PDFDocument({
      size: 'A4',
      layout: 'portrait',
      autoFirstPage: false,
      margin: 34,
      info: { Title: table.title, Author: 'Unispace' },
    });
    const buffers: Buffer[] = [];
    document.on('data', (chunk: Buffer) => buffers.push(chunk));
    const completion = new Promise<Buffer>((resolve, reject) => {
      document.on('end', () => resolve(Buffer.concat(buffers)));
      document.on('error', reject);
    });
    document.addPage();

    const left = 34;
    const contentWidth = document.page.width - left * 2;
    const columnFractions = [0.05, 0.17, 0.22, 0.15, 0.12, 0.29];
    const columnWidths = columnFractions.map((fraction) => contentWidth * fraction);
    const columns = [
      'No.',
      'Laporan / tanggal',
      'Fasilitas / kategori',
      'Pelapor',
      'Status',
      'Deskripsi',
    ];
    const logo = this.logoSvg();
    let page = 1;
    let y = 0;

    const footer = () => {
      const footerY = document.page.height - 50;
      document.strokeColor('#B8B8B8').lineWidth(0.5)
        .moveTo(left, footerY - 8)
        .lineTo(document.page.width - left, footerY - 8)
        .stroke();
      document.fillColor('#111111').font('Helvetica').fontSize(7)
        .text('Unispace  |  Halaman ' + page, left, footerY, {
          width: contentWidth,
          align: 'right',
        });
    };

    const drawColumnHeader = () => {
      const headerHeight = 24;
      document.fillColor('#E6E6E6').rect(left, y, contentWidth, headerHeight).fill();
      document.strokeColor('#777777').lineWidth(0.55)
        .rect(left, y, contentWidth, headerHeight)
        .stroke();
      document.fillColor('#111111').font('Helvetica-Bold').fontSize(7);
      let x = left;
      columns.forEach((column, index) => {
        document.text(column, x + 4, y + 8, {
          width: columnWidths[index] - 8,
          height: 9,
          ellipsis: true,
        });
        if (index > 0) {
          document.strokeColor('#A0A0A0').lineWidth(0.4)
            .moveTo(x, y)
            .lineTo(x, y + headerHeight)
            .stroke();
        }
        x += columnWidths[index];
      });
      y += headerHeight;
    };

    const drawPageHeader = () => {
      if (logo) {
        SVGtoPDF(document, logo, left, 22, {
          width: 128,
          height: 32,
          preserveAspectRatio: 'xMinYMin meet',
        });
      } else {
        document.fillColor('#111111').font('Helvetica-Bold').fontSize(17)
          .text('UNISPACE', left, 29);
      }
      document.fillColor('#111111').font('Helvetica-Bold').fontSize(13)
        .text('REKAP LAPORAN FASILITAS', 180, 24, {
          width: contentWidth - 146,
        });
      document.font('Helvetica').fontSize(8)
        .text('Periode: ' + String(metadata.filters['Periode'] ?? 'Sesuai periode'), 180, 46, {
          width: contentWidth - 146,
        })
        .text('Jumlah laporan: ' + records.length, 180, 61, {
          width: 180,
        })
        .text('Dibuat: ' + this.formatJakarta(metadata.generatedAt), 360, 61, {
          width: contentWidth - 180,
        });
      document.strokeColor('#333333').lineWidth(0.8)
        .moveTo(left, 88)
        .lineTo(document.page.width - left, 88)
        .stroke();
      y = 101;
      drawColumnHeader();
    };

    const addPage = () => {
      footer();
      document.addPage();
      page += 1;
      drawPageHeader();
    };

    drawPageHeader();
    if (records.length === 0) {
      document.fillColor('#111111').font('Helvetica').fontSize(8)
        .text('Tidak ada laporan pada periode yang dipilih.', left + 5, y + 10, {
          width: contentWidth - 10,
        });
    }

    records.forEach((record, index) => {
      const description = record.description.replace(/\s+/g, ' ').trim();
      const cells = [
        String(index + 1),
        record.reportNumber + '\n' + this.formatJakarta(record.createdAt),
        record.assetCode + '\n' + record.facilityName + '\n' + record.category,
        record.reporter,
        record.statusLabel,
        description.length > 280 ? description.slice(0, 277) + '...' : description,
      ];
      document.font('Helvetica').fontSize(6.5);
      const cellHeights = cells.map((cell, cellIndex) =>
        document.heightOfString(cell, {
          width: columnWidths[cellIndex] - 10,
          lineGap: 1,
        }),
      );
      const rowHeight = Math.max(25, ...cellHeights.map((height) => height + 10));
      if (y + rowHeight > document.page.height - 65) addPage();

      document.fillColor(index % 2 === 0 ? '#FFFFFF' : '#F5F5F5')
        .rect(left, y, contentWidth, rowHeight)
        .fill();
      document.strokeColor('#A0A0A0').lineWidth(0.4)
        .rect(left, y, contentWidth, rowHeight)
        .stroke();
      document.fillColor('#111111').font('Helvetica').fontSize(6.5);
      let x = left;
      cells.forEach((cell, cellIndex) => {
        document.text(cell, x + 5, y + 5, {
          width: columnWidths[cellIndex] - 10,
          height: rowHeight - 8,
          lineGap: 1,
          ellipsis: true,
        });
        if (cellIndex > 0) {
          document.strokeColor('#B0B0B0').lineWidth(0.35)
            .moveTo(x, y)
            .lineTo(x, y + rowHeight)
            .stroke();
        }
        x += columnWidths[cellIndex];
      });
      y += rowHeight;
    });

    footer();
    document.end();
    return completion;
  }

  private logoSvg() {
    const logoPath = [
      join(__dirname, 'assets', 'unispace-brand.svg'),
      join(__dirname, '..', '..', '..', 'unispace-frontend', 'public', 'Unispace_Logo_Trademark.svg'),
      join(process.cwd(), '..', 'unispace-frontend', 'public', 'Unispace_Logo_Trademark.svg'),
      join(process.cwd(), 'unispace-frontend', 'public', 'Unispace_Logo_Trademark.svg'),
    ].find((candidate) => existsSync(candidate));
    if (!logoPath) return null;
    return readFileSync(logoPath, 'utf8');
  }

  private async renderPdf(
    table: ExportTable,
    metadata: { filters: Record<string, unknown>; generatedAt: string },
  ) {
    const sections = table.sections?.length
      ? table.sections
      : [{ title: table.title, columns: table.columns, rows: table.rows }];
    const document = new PDFDocument({
      size: 'A4',
      layout: 'portrait',
      autoFirstPage: false,
      margin: 36,
      info: { Title: table.title, Author: 'Unispace' },
    });
    const buffers: Buffer[] = [];
    document.on('data', (chunk: Buffer) => buffers.push(chunk));
    const completion = new Promise<Buffer>((resolve, reject) => {
      document.on('end', () => resolve(Buffer.concat(buffers)));
      document.on('error', reject);
    });
    document.addPage();
    const left = 36;
    const contentWidth = document.page.width - left * 2;
    const logo = this.logoSvg();
    let page = 1;
    const header = () => {
      if (logo) {
        SVGtoPDF(document, logo, left, 25, {
          width: 112,
          height: 28,
          preserveAspectRatio: 'xMinYMin meet',
        });
      } else {
        document.fillColor('#111111').font('Helvetica-Bold').fontSize(14)
          .text('UNISPACE', left, 31);
      }
      document.fillColor('#111111').font('Helvetica-Bold').fontSize(13)
        .text(table.title.toLocaleUpperCase('id-ID'), 164, 27, {
          width: contentWidth - 128,
        });
      const extraFilters = this.filterText(metadata.filters);
      document
        .fillColor('#222222')
        .font('Helvetica')
        .fontSize(8)
        .text('Periode: ' + String(metadata.filters['Periode'] ?? 'Sesuai periode'), left, 67, {
          width: contentWidth,
        });
      if (extraFilters) {
        document.text('Filter: ' + extraFilters, left, 80, {
          width: contentWidth,
        });
      }
      const generatedAtY = extraFilters ? 93 : 81;
      const dividerY = extraFilters ? 108 : 96;
      document.text(
        'Dibuat: ' + this.formatJakarta(metadata.generatedAt),
        left,
        generatedAtY,
        { width: contentWidth },
      );
      document.strokeColor('#333333').lineWidth(0.8)
        .moveTo(left, dividerY)
        .lineTo(document.page.width - left, dividerY)
        .stroke();
      return dividerY + 12;
    };
    const footer = () => {
      document
        .fillColor('#222222')
        .font('Helvetica')
        .fontSize(8)
        .text(`Unispace  |  Halaman ${page}`, left, document.page.height - 48, {
          width: contentWidth,
          align: 'right',
        });
    };
    let y = header();
    const drawSectionHeader = (section: ExportSection) => {
      document.fillColor('#111111').font('Helvetica-Bold').fontSize(10)
        .text(section.title, left, y + 1, { width: contentWidth });
      y += 19;
      const widths = this.pdfColumnWidths(section, contentWidth);
      document
        .fillColor('#E6E6E6')
        .rect(left, y, contentWidth, 22)
        .fill();
      document.strokeColor('#777777').lineWidth(0.5)
        .rect(left, y, contentWidth, 22)
        .stroke();
      document.fillColor('#111111').font('Helvetica-Bold').fontSize(7);
      section.columns.forEach((column, index) => {
        const x = left + widths.slice(0, index).reduce((total, value) => total + value, 0);
        document.text(column, x + 4, y + 7, {
          width: widths[index] - 8,
          height: 9,
          ellipsis: true,
        });
        if (index > 0) {
          document.strokeColor('#A0A0A0').lineWidth(0.35)
            .moveTo(x, y)
            .lineTo(x, y + 22)
            .stroke();
        }
      });
      y += 24;
    };
    const addPageForSection = (section: ExportSection) => {
      footer();
      document.addPage();
      page += 1;
      y = header();
      drawSectionHeader(section);
    };

    sections.forEach((section) => {
      const columns = section.pdfColumns ?? section.columns;
      const rows = section.pdfRows ?? section.rows;
      const minimumSectionHeight = rows.length === 0 ? 67 : 66;
      if (y + minimumSectionHeight > document.page.height - 64) {
        footer();
        document.addPage();
        page += 1;
        y = header();
      }
      drawSectionHeader({ ...section, columns });
      if (rows.length === 0) {
        document.fillColor('#222222').font('Helvetica').fontSize(8)
          .text('Tidak ada data pada periode yang dipilih.', left + 4, y + 7, {
            width: contentWidth - 8,
          });
        y += 24;
      }
      const widths = this.pdfColumnWidths({ ...section, columns }, contentWidth);
      rows.forEach((row, rowIndex) => {
        document.font('Helvetica').fontSize(7);
        const cellHeights = row.map((cell, index) =>
          document.heightOfString(this.pdfCell(cell), {
            width: widths[index] - 10,
            lineGap: 1,
          }),
        );
        const rowHeight = Math.min(
          72,
          Math.max(23, ...cellHeights.map((height) => height + 9)),
        );
        if (y + rowHeight > document.page.height - 64) {
          addPageForSection({ ...section, columns });
        }
        if (rowIndex % 2 === 1) {
          document.fillColor('#F5F5F5')
            .rect(left, y, contentWidth, rowHeight)
            .fill();
        }
        document.strokeColor('#B0B0B0').lineWidth(0.35)
          .rect(left, y, contentWidth, rowHeight)
          .stroke();
        document.fillColor('#111111').font('Helvetica').fontSize(7);
        row.forEach((cell, index) => {
          const x = left + widths.slice(0, index).reduce((total, value) => total + value, 0);
          document.text(this.pdfCell(cell), x + 4, y + 5, {
            width: widths[index] - 8,
            height: rowHeight - 7,
            lineGap: 1,
            ellipsis: true,
          });
          if (index > 0) {
            document.strokeColor('#B0B0B0').lineWidth(0.3)
              .moveTo(x, y)
              .lineTo(x, y + rowHeight)
              .stroke();
          }
        });
        y += rowHeight;
      });
      y += 12;
    });
    footer();
    document.end();
    return completion;
  }

  private pdfColumnWidths(section: ExportSection, contentWidth: number) {
    const fractions = section.pdfColumnFractions;
    if (fractions?.length === section.columns.length) {
      const total = fractions.reduce((sum, fraction) => sum + fraction, 0);
      if (total > 0) return fractions.map((fraction) => (fraction / total) * contentWidth);
    }
    return section.columns.map(() => contentWidth / section.columns.length);
  }

  private toReportExportRecord(value: unknown): ReportExportRecord {
    const item = this.object(value);
    const facility = this.object(item.facility);
    const group = this.object(facility.facilityGroup);
    const area = this.object(facility.facilityArea);
    const type = this.object(facility.facilityType);
    const reporter = this.object(item.reporter);
    const acceptedBy = this.object(item.acceptedBy);
    const resolvedBy = this.object(item.resolvedBy);
    const text = (entry: unknown, fallback = '—') =>
      typeof entry === 'string' && entry.trim() ? entry.trim() : fallback;
    const nullableText = (entry: unknown) =>
      typeof entry === 'string' && entry.trim() ? entry.trim() : null;

    return {
      reportNumber: text(item.reportNumber),
      category: text(item.categoryLabel),
      status: text(item.status),
      statusLabel: this.reportStatusLabel(text(item.status)),
      assetCode: text(facility.assetCode),
      facilityName: text(facility.name),
      groupName: text(group.name),
      area: [text(area.code, ''), text(area.name, '')].filter(Boolean).join(' / ') || '—',
      type: text(type.name),
      mode: group.reservationMode === 'QUANTITY' ? 'Alat' : 'Ruang / area',
      reporter: text(reporter.name),
      createdAt: text(item.createdAt),
      acceptedAt: nullableText(item.acceptedAt),
      acceptedBy: nullableText(acceptedBy.name),
      resolvedAt: nullableText(item.resolvedAt),
      resolvedBy: nullableText(resolvedBy.name),
      resolutionHours:
        typeof item.resolutionHours === 'number' ? item.resolutionHours : null,
      description: text(item.description, 'Tidak ada deskripsi.'),
      attachments: this.array(item.attachments)
        .map((attachment) => this.object(attachment))
        .map((attachment) =>
          typeof attachment.name === 'string' ? attachment.name : '',
        )
        .filter(Boolean),
      decisionReason: nullableText(item.decisionReason),
      resolutionNote: nullableText(item.resolutionNote),
    };
  }

  private async describeFilters(filters: Record<string, unknown>) {
    const filterId = (key: string) =>
      typeof filters[key] === 'string' ? (filters[key] as string) : undefined;
    const areaId = filterId('facilityAreaId');
    const typeId = filterId('facilityTypeId');
    const groupId = filterId('facilityGroupId');
    const facilityId = filterId('facilityId');
    const [area, type, group, facility] = await Promise.all([
      areaId
        ? this.prisma.facilityArea.findUnique({
            where: { id: areaId },
            select: { code: true, name: true },
          })
        : Promise.resolve(null),
      typeId
        ? this.prisma.facilityType.findUnique({
            where: { id: typeId },
            select: { name: true },
          })
        : Promise.resolve(null),
      groupId
        ? this.prisma.facilityGroup.findUnique({
            where: { id: groupId },
            select: { name: true },
          })
        : Promise.resolve(null),
      facilityId
        ? this.prisma.facility.findUnique({
            where: { id: facilityId },
            select: {
              assetCode: true,
              name: true,
              facilityGroup: { select: { name: true } },
            },
          })
        : Promise.resolve(null),
    ]);
    const dateFrom =
      typeof filters.dateFrom === 'string'
        ? this.formatDateOnly(filters.dateFrom)
        : '—';
    const dateTo =
      typeof filters.dateTo === 'string'
        ? this.formatDateOnly(filters.dateTo)
        : '—';
    const mode =
      filters.reservationMode === 'EXCLUSIVE'
        ? 'Ruang / area'
        : filters.reservationMode === 'QUANTITY'
          ? 'Alat'
          : 'Semua';

    return {
      Periode: filters.allTime
        ? 'Semua waktu (' + dateFrom + ' - ' + dateTo + ')'
        : dateFrom === dateTo
          ? dateFrom
          : dateFrom + ' - ' + dateTo,
      Area: area ? area.code + ' · ' + area.name : 'Semua',
      Tipe: type?.name ?? 'Semua',
      Kelompok: group?.name ?? 'Semua',
      Unit: facility
        ? facility.assetCode + ' · ' + (facility.name ?? facility.facilityGroup.name)
        : 'Semua',
      Mode: mode,
    };
  }

  private array(value: unknown) {
    return Array.isArray(value) ? value : [];
  }

  private object(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  }

  private reportStatusLabel(status: string) {
    const labels: Record<string, string> = {
      NEW: 'Baru',
      IN_PROGRESS: 'Diproses',
      RESOLVED: 'Selesai',
      REJECTED: 'Ditolak',
    };
    return labels[status] ?? status;
  }

  private reservationStatusLabel(status: string) {
    const labels: Record<string, string> = {
      PENDING: 'Menunggu',
      APPROVED: 'Disetujui',
      COMPLETED: 'Selesai',
      REJECTED: 'Ditolak',
      CANCELLED_BY_USER: 'Dibatalkan pengguna',
      CANCELLED_BY_STAFF: 'Dibatalkan petugas',
      CANCELLED_BY_SYSTEM: 'Dibatalkan sistem',
    };
    return labels[status] ?? status;
  }

  private facilityStatusLabel(status: string) {
    const labels: Record<string, string> = {
      ACTIVE: 'Aktif',
      IN_MAINTENANCE: 'Dalam perawatan',
      NONACTIVE: 'Nonaktif',
    };
    return labels[status] ?? status;
  }

  private formatDateOnly(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Jakarta',
    }).format(new Date(value + 'T12:00:00+07:00'));
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

  private percentageCell(value: unknown): Cell {
    return typeof value === 'number'
      ? value.toFixed(1) + '%'
      : 'Tidak tersedia';
  }

  private filterText(filters: Record<string, unknown>) {
    const text = Object.entries(filters)
      .filter(
        ([key, value]) =>
          key !== 'Periode' &&
          value !== null &&
          value !== undefined &&
          value !== 'Semua',
      )
      .map(([key, value]) => key + ': ' + String(value))
      .join(', ');
    return text || null;
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
      timeStyle: 'short',
      timeZone: 'Asia/Jakarta',
    }).format(new Date(value));
  }

  private pdfCell(value: Cell) {
    return value === null || value === undefined ? '—' : String(value);
  }

}
