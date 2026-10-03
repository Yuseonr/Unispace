const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'unispace-frontend/src/features/facility-reports/components/staff-reports.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// We also need to add the import for StaffReportCard at the top
if (!content.includes('StaffReportCard')) {
  content = content.replace(
    /import \{ ReportDetailDrawer \} from "\.\/report-detail-drawer";/,
    `import { ReportDetailDrawer } from "./report-detail-drawer";\nimport { StaffReportCard } from "./staff-report-card";`
  );
}

// Find the return statement
const returnRegex = /return <section className="admin-page">[\s\S]*?<\/section>;\n\}/;

const newReturn = `return (
  <section className="admin-page">
    <PageHeader 
      action={<Link className="admin-secondary-button" href="/staff/reservations">Antrean reservasi</Link>} 
      eyebrow="Operasional" 
      title="Antrean Laporan Kendala"
    >
      Terima, tolak, selesaikan, dan jadwalkan perbaikan dari laporan pengguna.
    </PageHeader>
    
    {notice ? <p className="ui-form-feedback" role="status">{notice}</p> : null}
    {error ? <p className="ui-form-feedback ui-form-feedback--error" role="alert">{error}</p> : null}
    
    <section className="ui-surface">
      <div aria-label="Filter status laporan" className="report-status-tabs">
        {statusOptions.map((item) => (
          <button 
            className={(status === item.value || (status === undefined && item.value === undefined)) ? "is-active" : ""} 
            key={item.label} 
            onClick={() => updateQuery({ page: undefined, status: item.value || "ALL" })} 
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>
      
      <div className="ui-toolbar">
        <div className="ui-toolbar__filters">
          <label className="ui-field ui-field--search">
            <span>Cari</span>
            <input onChange={(event) => setSearchDraft(event.target.value)} placeholder="Nomor laporan, aset, fasilitas" type="search" value={searchDraft} />
          </label>
          <label className="ui-field">
            <span>Dibuat dari</span>
            <input onChange={(event) => updateQuery({ createdFrom: event.target.value || undefined, page: undefined })} type="date" value={createdFrom} />
          </label>
          <label className="ui-field">
            <span>Sampai</span>
            <input min={createdFrom} onChange={(event) => updateQuery({ createdTo: event.target.value || undefined, page: undefined })} type="date" value={createdTo} />
          </label>
        </div>
      </div>
      
      {loading ? (
        <LoadingState label="Memuat antrean laporan…" />
      ) : error && !reports.length ? (
        <ErrorState error={error} onRetry={() => void load()} />
      ) : reports.length ? (
        <>
          <div className="desktop-only">
            <div className="report-table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Nomor laporan</th>
                    <th>Fasilitas</th>
                    <th>Kategori</th>
                    <th>Pelapor</th>
                    <th>Dibuat</th>
                    <th>Status</th>
                    <th><span className="sr-only">Aksi</span></th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
                    <tr key={report.id}>
                      <td><strong>{report.reportNumber}</strong></td>
                      <td>{report.facility.assetCode}<br /><small>{report.facility.name ?? report.facility.facilityGroupName}</small></td>
                      <td>{report.categoryLabel}</td>
                      <td>{report.reporter?.name ?? "—"}</td>
                      <td>{formatJakartaDateTime(report.createdAt)}</td>
                      <td><StatusBadge label={report.statusLabel} status={report.status} /></td>
                      <td><button onClick={() => void openDetail(report.id)} type="button">Rincian</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="mobile-only">
            {reports.map((report) => (
              <StaffReportCard key={report.id} report={report} onDetail={(r) => openDetail(r.id)} />
            ))}
          </div>
          
          <Pagination onPageChange={(nextPage) => updateQuery({ page: String(nextPage) })} page={meta.page} total={meta.total} totalPages={meta.totalPages} />
        </>
      ) : (
        <div className="ui-state ui-state--empty">
          <strong>Tidak ada laporan</strong>
          <span>Ubah filter untuk melihat laporan lain.</span>
        </div>
      )}
    </section>
    
    {selected ? <ReportDetailDrawer actions={actionPanel} audit={audit} onClose={() => setSelected(null)} report={selected} showReporter /> : null}
    <ConfirmDialog confirmLabel="Tolak laporan" destructive error={!reason.trim() ? "Alasan penolakan wajib diisi." : null} isOpen={dialog === "reject"} onClose={() => !busy && setDialog(null)} onConfirm={() => void reject()} title="Tolak laporan"><label className="ui-form-field"><span>Alasan penolakan</span><textarea onChange={(event) => setReason(event.target.value)} value={reason} /></label></ConfirmDialog>
    <ConfirmDialog confirmLabel="Selesaikan laporan" error={!resolutionNote.trim() ? "Catatan penyelesaian wajib diisi." : null} isOpen={dialog === "resolve"} onClose={() => !busy && setDialog(null)} onConfirm={() => void resolve()} title="Selesaikan laporan"><label className="ui-form-field"><span>Catatan penyelesaian</span><textarea onChange={(event) => setResolutionNote(event.target.value)} value={resolutionNote} /></label><p>Pastikan tidak ada maintenance aktif atau terjadwal sebelum menandai laporan selesai.</p></ConfirmDialog>
    <ConfirmDialog confirmLabel="Konfirmasi perbaikan" destructive error={!reason.trim() ? "Alasan pembatalan wajib diisi." : null} isOpen={dialog === "maintenance"} onClose={() => !busy && setDialog(null)} onConfirm={() => void confirmPreview()} title={\`Konfirmasi perbaikan dan batalkan \${preview?.approvedReservations.length ?? 0} reservasi\`}><p>Backend akan menolak reservasi pending yang tidak lagi memungkinkan setelah maintenance diterapkan.</p><label className="ui-form-field"><span>Alasan pembatalan reservasi terdampak</span><textarea onChange={(event) => setReason(event.target.value)} value={reason} /></label></ConfirmDialog>
    <ConfirmDialog confirmLabel="Akhiri perbaikan" destructive isOpen={dialog?.startsWith("end:") ?? false} onClose={() => !busy && setDialog(null)} onConfirm={() => { if (dialog?.startsWith("end:")) void endEarly(dialog.slice(4)); }} title="Akhiri perbaikan lebih awal"><p>Hanya periode yang sedang aktif dapat diakhiri. Status efektif fasilitas akan dihitung ulang oleh backend.</p></ConfirmDialog>
  </section>
);
}`;

content = content.replace(returnRegex, newReturn);
fs.writeFileSync(filePath, content);
console.log("Done replacing return block.");
