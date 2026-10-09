import { StatusBadge } from "@/components/ui/page-primitives";
import { formatJakartaDateTime } from "@/lib/format";
import type { FacilityReport } from "../api";

export function StaffReportCard({
  report,
  onDetail,
}: {
  report: FacilityReport;
  onDetail: (report: FacilityReport) => void;
}) {
  return (
    <article
      className="user-res-card"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.85rem",
        padding: "1.25rem",
        borderRadius: "12px",
        border: "1px solid #e2e8f0",
        background: "#ffffff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem", flexWrap: "wrap" }}>
        <div>
          <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>
            {report.reportNumber}
          </h3>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", color: "#475569" }}>
            {report.facility.assetCode} - {report.facility.name ?? report.facility.facilityGroupName}
          </p>
        </div>
        <StatusBadge label={report.statusLabel} status={report.status} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
        <div>
          <span style={{ display: "block", fontSize: "0.75rem", color: "#64748b", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.025em" }}>
            Kategori
          </span>
          <span style={{ fontSize: "0.875rem", color: "#1e293b", fontWeight: 600 }}>
            {report.categoryLabel}
          </span>
        </div>
        <div>
          <span style={{ display: "block", fontSize: "0.75rem", color: "#64748b", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.025em" }}>
            Pelapor
          </span>
          <span style={{ fontSize: "0.875rem", color: "#1e293b", fontWeight: 600 }}>
            {report.reporter?.name ?? "-"}
          </span>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <span style={{ display: "block", fontSize: "0.75rem", color: "#64748b", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.025em" }}>
            Dibuat
          </span>
          <span style={{ fontSize: "0.875rem", color: "#1e293b", fontWeight: 600 }}>
            {formatJakartaDateTime(report.createdAt)}
          </span>
        </div>
      </div>

      <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "0.85rem", display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
        <button
          className="admin-secondary-button"
          onClick={() => onDetail(report)}
          type="button"
          style={{ width: "100%", justifyContent: "center" }}
        >
          Rincian
        </button>
      </div>
    </article>
  );
}
