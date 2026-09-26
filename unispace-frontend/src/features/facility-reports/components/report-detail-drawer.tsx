"use client";

import { StatusBadge } from "@/components/ui/page-primitives";
import { formatJakartaDateTime } from "@/lib/format";

import type { FacilityReport, ReportAuditItem } from "../api";
import { AttachmentPreview } from "./attachment-preview";

export function ReportDetailDrawer({
  actions,
  audit = [],
  onClose,
  report,
  showReporter = false,
}: {
  actions?: React.ReactNode;
  audit?: ReportAuditItem[];
  onClose: () => void;
  report: FacilityReport;
  showReporter?: boolean;
}) {
  return <>
    <button aria-label="Tutup detail laporan" className="detail-drawer__backdrop" onClick={onClose} type="button" />
    <aside aria-label={`Detail laporan ${report.reportNumber}`} className="detail-drawer">
      <header className="detail-drawer__header"><div><p className="ui-eyebrow">Laporan fasilitas</p><h2>{report.reportNumber}</h2></div><button onClick={onClose} type="button">Tutup ×</button></header>
      <div><StatusBadge label={report.statusLabel} status={report.status} /></div>
      <dl className="detail-grid"><div><dt>Fasilitas</dt><dd>{report.facility.assetCode} · {report.facility.name ?? report.facility.facilityGroupName}</dd></div><div><dt>Kelompok / mode</dt><dd>{report.facility.facilityGroupName} · {report.facility.reservationMode === "QUANTITY" ? "Alat" : "Ruang"}</dd></div><div><dt>Kategori</dt><dd>{report.categoryLabel}</dd></div><div><dt>Dibuat</dt><dd>{formatJakartaDateTime(report.createdAt)}</dd></div>{showReporter ? <div><dt>Pelapor</dt><dd>{report.reporter ? `${report.reporter.name} · ${report.reporter.email ?? report.reporter.identityNumber ?? ""}` : "—"}</dd></div> : null}<div><dt>Diproses</dt><dd>{report.acceptedBy ? `${report.acceptedBy.name} · ${formatJakartaDateTime(report.acceptedAt)}` : "Belum diterima"}</dd></div></dl>
      <section className="report-detail-section"><h3>Deskripsi kendala</h3><p>{report.description}</p></section>
      {report.decisionReason ? <section className="report-detail-section report-detail-section--warning"><h3>Alasan penolakan</h3><p>{report.decisionReason}</p></section> : null}
      {report.resolutionNote ? <section className="report-detail-section report-detail-section--success"><h3>Catatan penyelesaian</h3><p>{report.resolutionNote}</p></section> : null}
      <section className="report-detail-section"><h3>Foto bukti</h3><div className="report-attachments">{report.attachments.length ? report.attachments.map((attachment) => <AttachmentPreview attachment={attachment} key={attachment.id} />) : <p>Tidak ada attachment.</p>}</div></section>
      <section className="report-detail-section"><h3>Riwayat perbaikan</h3>{report.maintenancePeriods.length ? <ul className="report-timeline">{report.maintenancePeriods.map((period) => <li key={period.id}><strong>{new Date(period.startAt) <= new Date() && new Date(period.endAt) > new Date() ? "Aktif" : new Date(period.startAt) > new Date() ? "Terjadwal" : "Berakhir"}</strong><span>{formatJakartaDateTime(period.startAt)} — {formatJakartaDateTime(period.endAt)}</span>{period.note ? <small>{period.note}</small> : null}</li>)}</ul> : <p>Belum ada jadwal perbaikan.</p>}</section>
      {audit.length ? <section className="report-detail-section"><h3>Timeline audit</h3><ul className="report-timeline">{audit.map((item) => <li key={item.id}><strong>{item.action.replaceAll("_", " ")}</strong><span>{item.actor?.name ?? "Sistem"} · {formatJakartaDateTime(item.createdAt)}</span></li>)}</ul></section> : null}
      {actions ? <section className="report-detail-actions">{actions}</section> : null}
    </aside>
  </>;
}
