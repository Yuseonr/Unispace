"use client";

import { useEffect, useRef } from "react";

import { StatusBadge } from "@/components/ui/page-primitives";
import { formatJakartaDateTime } from "@/lib/format";

import type { FacilityReport, ReportAuditItem } from "../api";
import { AttachmentPreview } from "./attachment-preview";

export function ReportDetailDrawer({
  actions,
  audit = [],
  onClose,
  presentation = "drawer",
  report,
  showReporter = false,
}: {
  actions?: React.ReactNode;
  audit?: ReportAuditItem[];
  onClose: () => void;
  presentation?: "centered" | "drawer";
  report: FacilityReport;
  showReporter?: boolean;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.key === "Escape" &&
        !document.querySelector(".attachment-lightbox")
      )
        onClose();
      if (event.key !== "Tab") return;

      const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !modalRef.current?.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !modalRef.current?.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [onClose]);

  return (
    <>
      <div
        aria-labelledby="report-detail-title"
        aria-modal="true"
        className={`report-detail-modal-backdrop${presentation === "drawer" ? " report-detail-modal-backdrop--drawer" : ""}`}
        role="dialog"
      >
        <button
          aria-label="Tutup detail laporan"
          className="report-detail-modal__backdrop"
          onClick={onClose}
          tabIndex={-1}
          type="button"
        />
        <section
          className={`report-detail-modal${presentation === "drawer" ? " report-detail-modal--drawer" : ""}`}
          ref={modalRef}
        >
          <header className="report-detail-modal__header">
            <div>
              <p className="ui-eyebrow">Laporan fasilitas</p>
              <h2 id="report-detail-title">{report.reportNumber}</h2>
            </div>
            <button
              aria-label="Tutup detail laporan"
              className="report-detail-modal__close"
              onClick={onClose}
              ref={closeButtonRef}
              type="button"
            >
              ×
            </button>
          </header>
          <div className="report-detail-modal__status">
            <StatusBadge label={report.statusLabel} status={report.status} />
          </div>
          <dl className="detail-grid">
            <div>
              <dt>Fasilitas</dt>
              <dd>
                {report.facility.assetCode}
                <br />
                {report.facility.name ?? report.facility.facilityGroupName}
              </dd>
            </div>
            <div>
              <dt>Kelompok / mode</dt>
              <dd>
                {report.facility.facilityGroupName}
                <br />
                {report.facility.reservationMode === "QUANTITY"
                  ? "Alat"
                  : "Ruang"}
              </dd>
            </div>
            <div>
              <dt>Kategori</dt>
              <dd>{report.categoryLabel}</dd>
            </div>
            <div>
              <dt>Dibuat</dt>
              <dd>{formatJakartaDateTime(report.createdAt)}</dd>
            </div>
            {showReporter ? (
              <div>
                <dt>Pelapor</dt>
                <dd>
                  {report.reporter
                    ? `${report.reporter.name}, ${report.reporter.email ?? report.reporter.identityNumber ?? ""}`
                    : "-"}
                </dd>
              </div>
            ) : null}
            <div>
              <dt>Diproses</dt>
              <dd>
                {report.acceptedBy
                  ? `${report.acceptedBy.name}, ${formatJakartaDateTime(report.acceptedAt)}`
                  : "Belum diterima"}
              </dd>
            </div>
          </dl>
          <section className="report-detail-section report-detail-section--description">
            <h3>Deskripsi kendala</h3>
            <p>{report.description}</p>
          </section>
          {report.decisionReason ? (
            <section className="report-detail-section report-detail-section--warning">
              <h3>Alasan penolakan</h3>
              <p>{report.decisionReason}</p>
            </section>
          ) : null}
          {report.resolutionNote ? (
            <section className="report-detail-section report-detail-section--success">
              <h3>Catatan penyelesaian</h3>
              <p>{report.resolutionNote}</p>
            </section>
          ) : null}
          <section className="report-detail-section">
            <h3>Foto bukti</h3>
            <div className="report-attachments">
              {report.attachments.length ? (
                report.attachments.map((attachment) => (
                  <AttachmentPreview
                    attachment={attachment}
                    key={attachment.id}
                  />
                ))
              ) : (
                <p>Tidak ada attachment.</p>
              )}
            </div>
          </section>
          <section className="report-detail-section">
            <h3>Riwayat perbaikan</h3>
            {report.maintenancePeriods.length ? (
              <ul className="report-timeline">
                {report.maintenancePeriods.map((period) => (
                  <li key={period.id}>
                    <strong>
                      {new Date(period.startAt) <= new Date() &&
                      new Date(period.endAt) > new Date()
                        ? "Aktif"
                        : new Date(period.startAt) > new Date()
                          ? "Terjadwal"
                          : "Berakhir"}
                    </strong>
                    <span>
                      {formatJakartaDateTime(period.startAt)} sampai{" "}
                      {formatJakartaDateTime(period.endAt)}
                    </span>
                    {period.note ? <small>{period.note}</small> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="report-detail-section__empty">
                Belum ada jadwal perbaikan.
              </p>
            )}
          </section>
          {audit.length ? (
            <section className="report-detail-section">
              <h3>Timeline audit</h3>
              <ul className="report-timeline">
                {audit.map((item) => (
                  <li key={item.id}>
                    <strong>{item.action.replaceAll("_", " ")}</strong>
                    <span>
                      {item.actor?.name ?? "Sistem"},{" "}
                      {formatJakartaDateTime(item.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {actions ? (
            <section className="report-detail-actions">{actions}</section>
          ) : null}
        </section>
      </div>
    </>
  );
}
