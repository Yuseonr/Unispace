"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/features/auth/auth-provider";
import {
  apiErrorMessage,
  type AdminFacilityArea,
  type AdminFacilityType,
  type FacilityAreaStatus,
  type FacilityTypeStatus,
} from "@/features/facilities/admin-types";

type MasterKind = "area" | "type";
type MasterStatus = "ACTIVE" | "NONACTIVE";
type AreaForm = { code: string; name: string };
type TypeForm = { name: string };

const emptyArea: AreaForm = { code: "", name: "" };
const emptyType: TypeForm = { name: "" };

function EditIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m4 16.5-.7 4.2 4.2-.7L19 8.5 15.5 5zM13.9 6.6l3.5 3.5" /></svg>;
}

function CloseIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18" /></svg>;
}

function ToggleIcon({ active }: { active: boolean }) {
  return <span aria-hidden="true" className={`admin-master-toggle__track${active ? " is-active" : ""}`}><span /></span>;
}

function validArea(form: AreaForm) {
  if (!/^[A-Z0-9_]{2,30}$/.test(form.code.trim().toUpperCase())) {
    return "Kode area memakai 2–30 huruf kapital, angka, atau underscore.";
  }
  if (form.name.trim().length < 2 || form.name.trim().length > 120) {
    return "Nama area harus berisi 2–120 karakter.";
  }
  return null;
}

function validType(form: TypeForm) {
  if (!form.name.trim() || form.name.trim().length > 100) {
    return "Nama tipe wajib diisi dan maksimal 100 karakter.";
  }
  return null;
}

export function FacilityMasters({ kind }: { kind: MasterKind }) {
  const { request } = useAuth();
  const [areas, setAreas] = useState<AdminFacilityArea[]>([]);
  const [types, setTypes] = useState<AdminFacilityType[]>([]);
  const [areaForm, setAreaForm] = useState<AreaForm>(emptyArea);
  const [typeForm, setTypeForm] = useState<TypeForm>(emptyType);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<MasterStatus>("ACTIVE");

  const copy = useMemo(() => kind === "area" ? {
    add: "Tambah Area",
    formTitle: editingId ? "Ubah area kampus" : "Area kampus baru",
    title: "Area kampus",
  } : {
    add: "Tambah Tipe",
    formTitle: editingId ? "Ubah tipe fasilitas" : "Tipe fasilitas baru",
    title: "Tipe fasilitas",
  }, [editingId, kind]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (kind === "area") {
        setAreas(await request<AdminFacilityArea[]>("/admin/facilities/areas"));
      } else {
        setTypes(await request<AdminFacilityType[]>("/admin/facilities/types"));
      }
    } catch (nextError) {
      setError(apiErrorMessage(nextError, "Data belum dapat dimuat. Coba lagi."));
    } finally {
      setIsLoading(false);
    }
  }, [kind, request]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    setStatusFilter("ACTIVE");
  }, [kind]);

  const activeCount = kind === "area"
    ? areas.filter((area) => area.status === "ACTIVE").length
    : types.filter((type) => type.status === "ACTIVE").length;
  const inactiveCount = kind === "area"
    ? areas.filter((area) => area.status === "NONACTIVE").length
    : types.filter((type) => type.status === "NONACTIVE").length;
  const visibleAreas = areas.filter((area) => area.status === statusFilter);
  const visibleTypes = types.filter((type) => type.status === statusFilter);
  const emptyStatusLabel = statusFilter === "ACTIVE" ? "aktif" : "nonaktif";

  function closeForm() {
    setEditingId(null);
    setAreaForm(emptyArea);
    setTypeForm(emptyType);
    setFormOpen(false);
  }

  function beginAdd() {
    setError(null);
    setEditingId(null);
    setAreaForm(emptyArea);
    setTypeForm(emptyType);
    setFormOpen(true);
  }

  function beginEdit(item: AdminFacilityArea | AdminFacilityType) {
    setError(null);
    setEditingId(item.id);
    if (kind === "area") {
      const area = item as AdminFacilityArea;
      setAreaForm({ code: area.code, name: area.name });
    } else {
      setTypeForm({ name: (item as AdminFacilityType).name });
    }
    setFormOpen(true);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = kind === "area" ? validArea(areaForm) : validType(typeForm);
    if (validation) {
      setError(validation);
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const endpoint = kind === "area" ? "/admin/facilities/areas" : "/admin/facilities/types";
      const body = kind === "area"
        ? { code: areaForm.code.trim().toUpperCase(), name: areaForm.name.trim() }
        : { name: typeForm.name.trim() };
      await request(editingId ? `${endpoint}/${editingId}` : endpoint, {
        body,
        method: editingId ? "PATCH" : "POST",
      });
      closeForm();
      await load();
    } catch (nextError) {
      setError(apiErrorMessage(nextError, "Perubahan belum dapat disimpan. Coba lagi."));
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleArea(area: AdminFacilityArea) {
    const status: FacilityAreaStatus = area.status === "ACTIVE" ? "NONACTIVE" : "ACTIVE";
    setError(null);
    try {
      await request(`/admin/facilities/areas/${area.id}/status`, { body: { status }, method: "PATCH" });
      await load();
    } catch (nextError) {
      setError(apiErrorMessage(nextError, "Status area belum dapat diubah."));
    }
  }

  async function toggleType(type: AdminFacilityType) {
    const status: FacilityTypeStatus = type.status === "ACTIVE" ? "NONACTIVE" : "ACTIVE";
    setError(null);
    try {
      await request(`/admin/facilities/types/${type.id}/status`, { body: { status }, method: "PATCH" });
      await load();
    } catch (nextError) {
      setError(apiErrorMessage(nextError, "Status tipe belum dapat diubah."));
    }
  }

  return (
    <main className="admin-page admin-master-page">
      <header className="admin-facility-page-header">
        <div>
          <h1>{copy.title}</h1>
        </div>
        <button className="admin-primary-button" onClick={beginAdd} type="button"><span aria-hidden="true">+</span>{copy.add}</button>
      </header>

      {error ? <p className="admin-master-error" role="alert">{error}</p> : null}

      <div aria-label={"Status " + copy.title} className="admin-master-tabs" role="tablist">
        <button aria-controls="admin-master-list" aria-selected={statusFilter === "ACTIVE"} className={"admin-master-tab" + (statusFilter === "ACTIVE" ? " is-active" : "")} id="admin-master-active-tab" onClick={() => setStatusFilter("ACTIVE")} role="tab" type="button">
          Aktif <span>{activeCount}</span>
        </button>
        <button aria-controls="admin-master-list" aria-selected={statusFilter === "NONACTIVE"} className={"admin-master-tab" + (statusFilter === "NONACTIVE" ? " is-active" : "")} id="admin-master-inactive-tab" onClick={() => setStatusFilter("NONACTIVE")} role="tab" type="button">
          Nonaktif <span>{inactiveCount}</span>
        </button>
      </div>

      <section aria-labelledby={statusFilter === "ACTIVE" ? "admin-master-active-tab" : "admin-master-inactive-tab"} className="admin-master-surface" id="admin-master-list" role="tabpanel">
        {isLoading ? <p className="admin-master-empty">Memuat data…</p> : null}
        {!isLoading && kind === "area" ? (
          <div className="admin-master-table-wrap">
            <table className="admin-master-table">
              <thead><tr><th>Kode</th><th>Nama area</th><th>Fasilitas</th><th>Status</th><th>Aksi</th></tr></thead>
              <tbody>{visibleAreas.length ? visibleAreas.map((area) => <tr key={area.id}>
                <td><code>{area.code}</code></td>
                <td><strong>{area.name}</strong></td>
                <td>{area._count.facilityGroups} kelompok</td>
                <td><span className={`admin-status-pill admin-status-pill--${area.status.toLowerCase()}`}>{area.status === "ACTIVE" ? "Aktif" : "Nonaktif"}</span></td>
                <td><div className="admin-master-actions"><button aria-label={`Ubah ${area.name}`} className="admin-icon-button" onClick={() => beginEdit(area)} type="button"><EditIcon /></button><button aria-label={`${area.status === "ACTIVE" ? "Nonaktifkan" : "Aktifkan"} ${area.name}`} className="admin-master-toggle" onClick={() => void toggleArea(area)} type="button"><ToggleIcon active={area.status === "ACTIVE"} /></button></div></td>
              </tr>) : <tr><td className="admin-master-empty" colSpan={5}>Belum ada {kind === "area" ? "area kampus" : "tipe fasilitas"} {emptyStatusLabel}.</td></tr>}</tbody>
            </table>
          </div>
        ) : null}
        {!isLoading && kind === "type" ? (
          <div className="admin-master-table-wrap">
            <table className="admin-master-table admin-master-table--type">
              <thead><tr><th>Nama tipe</th><th>Kelompok fasilitas</th><th>Status</th><th>Aksi</th></tr></thead>
              <tbody>{visibleTypes.length ? visibleTypes.map((type) => <tr key={type.id}>
                <td><strong>{type.name}</strong></td>
                <td>{type._count?.facilityGroups ?? 0} kelompok</td>
                <td><span className={"admin-status-pill admin-status-pill--" + type.status.toLowerCase()}>{type.status === "ACTIVE" ? "Aktif" : "Nonaktif"}</span></td>
                <td><div className="admin-master-actions"><button aria-label={`Ubah ${type.name}`} className="admin-icon-button" onClick={() => beginEdit(type)} type="button"><EditIcon /></button><button aria-label={(type.status === "ACTIVE" ? "Nonaktifkan" : "Aktifkan") + " " + type.name} className="admin-master-toggle" onClick={() => void toggleType(type)} type="button"><ToggleIcon active={type.status === "ACTIVE"} /></button></div></td>
              </tr>) : <tr><td className="admin-master-empty" colSpan={4}>Belum ada tipe fasilitas {emptyStatusLabel}.</td></tr>}</tbody>
            </table>
          </div>
        ) : null}
      </section>

      {formOpen ? <div className="admin-dialog-backdrop" role="presentation">
        <section aria-labelledby="master-form-title" aria-modal="true" className="admin-master-dialog" role="dialog">
          <header><div><p className="admin-eyebrow">{kind === "area" ? "Area kampus" : "Tipe fasilitas"}</p><h2 id="master-form-title">{copy.formTitle}</h2></div><button aria-label="Tutup" className="admin-dialog-close" onClick={closeForm} type="button"><CloseIcon /></button></header>
          <form onSubmit={(event) => void save(event)}>
            {kind === "area" ? <><label>Kode area<input autoCapitalize="characters" maxLength={30} onChange={(event) => setAreaForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} placeholder="Contoh: FASILITAS_UMUM" value={areaForm.code} /></label><label>Nama area<input maxLength={120} onChange={(event) => setAreaForm((current) => ({ ...current, name: event.target.value }))} placeholder="Contoh: Fasilitas Umum" value={areaForm.name} /></label></> : <label>Nama tipe<input maxLength={100} onChange={(event) => setTypeForm({ name: event.target.value })} placeholder="Contoh: Ruang kelas" value={typeForm.name} /></label>}
            <footer><button className="admin-secondary-button" onClick={closeForm} type="button">Batal</button><button className="admin-primary-button" disabled={isSaving} type="submit">{isSaving ? "Menyimpan…" : "Simpan"}</button></footer>
          </form>
        </section>
      </div> : null}
    </main>
  );
}
