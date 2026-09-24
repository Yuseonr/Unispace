"use client";
/* eslint-disable @next/next/no-img-element -- private image endpoint is dynamic and also previews object URLs. */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/features/auth/auth-provider";
import {
  apiErrorMessage,
  type AdminFacilityArea,
  type AdminFacilityGroup,
  type AdminFacilityType,
  type AdminFacilityUnit,
  type FacilityMode,
} from "@/features/facilities/admin-types";

type FacilityForm = {
  areaId: string;
  assetCode: string;
  capacity: string;
  description: string;
  locationDetail: string;
  mode: FacilityMode;
  name: string;
  typeId: string;
};

const emptyForm: FacilityForm = {
  areaId: "",
  assetCode: "",
  capacity: "",
  description: "",
  locationDetail: "",
  mode: "EXCLUSIVE",
  name: "",
  typeId: "",
};

function BackIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m14.5 5.5-6.5 6.5 6.5 6.5" /></svg>;
}

function UploadIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 16V4M7.5 8.5 12 4l4.5 4.5M5 16.5v2A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-2" /></svg>;
}

function EditIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m4 16.5-.7 4.2 4.2-.7L19 8.5 15.5 5zM13.9 6.6l3.5 3.5" /></svg>;
}

function PhotoPlaceholder() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><rect height="14" rx="2" width="18" x="3" y="5" /><circle cx="8.5" cy="10" r="1.5" /><path d="m5 17 4.3-4.3a1.4 1.4 0 0 1 2 0l2.2 2.2 1.3-1.3a1.4 1.4 0 0 1 2 0L20 17" /></svg>;
}

function ChevronIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m7.5 9.5 4.5 4.5 4.5-4.5" /></svg>;
}

function StatusToggle({ active }: { active: boolean }) {
  return <span aria-hidden="true" className={`admin-master-toggle__track${active ? " is-active" : ""}`}><span /></span>;
}

function CloseIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18" /></svg>;
}

function SearchIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.2" /><path d="m15.4 15.4 4.1 4.1" /></svg>;
}

type FacilitySelectOption = { label: string; value: string };

function FacilitySelect({
  isOpen,
  onChange,
  onToggle,
  options,
  placeholder,
  value,
}: {
  isOpen: boolean;
  onChange: (value: string) => void;
  onToggle: () => void;
  options: FacilitySelectOption[];
  placeholder: string;
  value: string;
}) {
  const selected = options.find((option) => option.value === value);

  return <div className="admin-facility-select">
    <button aria-expanded={isOpen} aria-haspopup="listbox" className="admin-facility-select__trigger" onClick={onToggle} type="button">
      <span>{selected?.label ?? placeholder}</span><ChevronIcon />
    </button>
    {isOpen ? <div className="admin-facility-select__menu" role="listbox">
      {options.map((option) => <button aria-selected={option.value === value} className={option.value === value ? "is-selected" : ""} key={option.value} onClick={() => onChange(option.value)} role="option" type="button">{option.label}</button>)}
    </div> : null}
  </div>;
}

function validForm(form: FacilityForm, isNew: boolean, hasImage: boolean) {
  if (!form.name.trim() || form.name.trim().length > 150) return "Nama fasilitas wajib diisi dan maksimal 150 karakter.";
  if (!form.typeId) return "Pilih tipe fasilitas.";
  if (!form.areaId) return "Pilih area kampus.";
  if (!form.locationDetail.trim() || form.locationDetail.trim().length > 500) return "Lokasi detail wajib diisi dan maksimal 500 karakter.";
  if (form.capacity && (!/^\d+$/.test(form.capacity) || Number(form.capacity) < 0)) return "Kapasitas harus berupa angka nol atau lebih.";
  if (isNew && form.mode === "EXCLUSIVE" && !form.assetCode.trim()) return "Kode aset wajib diisi untuk ruang atau area eksklusif.";
  if (isNew && !hasImage) return "Unggah foto utama fasilitas terlebih dahulu.";
  return null;
}

function modeCopy(mode: FacilityMode) {
  return mode === "EXCLUSIVE" ? "Ruang / area eksklusif" : "Alat bergerak";
}

export function FacilityEditor({ facilityId }: { facilityId?: string }) {
  const isNew = !facilityId;
  const router = useRouter();
  const { request } = useAuth();
  const [areas, setAreas] = useState<AdminFacilityArea[]>([]);
  const [types, setTypes] = useState<AdminFacilityType[]>([]);
  const [facility, setFacility] = useState<AdminFacilityGroup | null>(null);
  const [form, setForm] = useState<FacilityForm>(emptyForm);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [newUnitCode, setNewUnitCode] = useState("");
  const [isAddUnitOpen, setIsAddUnitOpen] = useState(false);
  const [openSelect, setOpenSelect] = useState<"area" | "type" | "unit-status" | null>(null);
  const [unitStatusFilter, setUnitStatusFilter] = useState<"ACTIVE" | "NONACTIVE">("ACTIVE");
  const [unitQuery, setUnitQuery] = useState("");
  const [unitDrafts, setUnitDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingFacilityStatus, setIsUpdatingFacilityStatus] = useState(false);
  const [savingUnitId, setSavingUnitId] = useState<string | null>(null);

  const load = useCallback(async (showLoading = true) => {
    setError(null);
    if (showLoading) {
      setIsLoading(true);
    }
    try {
      const [nextAreas, nextTypes, allFacilities] = await Promise.all([
        request<AdminFacilityArea[]>("/admin/facilities/areas"),
        request<AdminFacilityType[]>("/admin/facilities/types"),
        facilityId ? request<AdminFacilityGroup[]>("/admin/facilities") : Promise.resolve<AdminFacilityGroup[]>([]),
      ]);
      setAreas(nextAreas.filter((area) => area.status === "ACTIVE"));
      setTypes(nextTypes);

      if (!facilityId) return;
      const found = allFacilities.find((item) => item.id === facilityId);
      if (!found) {
        setError("Fasilitas tidak ditemukan.");
        return;
      }
      setFacility(found);
      setForm({
        areaId: found.facilityAreaId,
        assetCode: found.reservationMode === "EXCLUSIVE" ? found.facilities[0]?.assetCode ?? "" : "",
        capacity: found.capacity === null ? "" : String(found.capacity),
        description: found.description ?? "",
        locationDetail: found.locationDetail,
        mode: found.reservationMode,
        name: found.name,
        typeId: found.facilityTypeId,
      });
      setUnitDrafts(Object.fromEntries(found.facilities.map((unit) => [unit.id, unit.assetCode])));
    } catch (nextError) {
      setError(apiErrorMessage(nextError, "Data fasilitas belum dapat dimuat. Coba lagi."));
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, [facilityId, request]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  function updateField<Field extends keyof FacilityForm>(field: Field, value: FacilityForm[Field]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function changeImage(file: File | null) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Foto fasilitas harus berupa JPEG, PNG, atau WebP.");
      return;
    }
    if (file.size === 0 || file.size > 5 * 1024 * 1024) {
      setError("Ukuran foto fasilitas harus lebih dari 0 dan maksimal 5 MB.");
      return;
    }
    setError(null);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const nextPreviewUrl = URL.createObjectURL(file);
    previewUrlRef.current = nextPreviewUrl;
    setPreviewUrl(nextPreviewUrl);
    setSelectedImage(file);
  }

  function toFormData() {
    const body = new FormData();
    body.set("name", form.name.trim());
    body.set("facilityTypeId", form.typeId);
    body.set("facilityAreaId", form.areaId);
    body.set("locationDetail", form.locationDetail.trim());
    if (form.capacity) body.set("capacity", form.capacity);
    if (form.description.trim()) body.set("description", form.description.trim());
    if (isNew) {
      body.set("reservationMode", form.mode);
      if (form.mode === "EXCLUSIVE") body.set("assetCode", form.assetCode.trim());
    }
    if (selectedImage) body.set("primaryImage", selectedImage);
    return body;
  }

  async function saveFacility(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validForm(form, isNew, Boolean(selectedImage || facility?.primaryImageUrl));
    if (validation) {
      setError(validation);
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      if (isNew) {
        const created = await request<AdminFacilityGroup>("/admin/facilities/groups", { body: toFormData(), method: "POST" });
        router.replace(`/admin/facilities/${created.id}`);
        return;
      }

      if (!facility) return;
      await request(`/admin/facilities/groups/${facility.id}`, { body: toFormData(), method: "PATCH" });
      const exclusiveUnit = facility.reservationMode === "EXCLUSIVE" ? facility.facilities[0] : undefined;
      if (exclusiveUnit && form.assetCode.trim() !== exclusiveUnit.assetCode) {
        await request(`/admin/facilities/units/${exclusiveUnit.id}`, { body: { assetCode: form.assetCode.trim() }, method: "PATCH" });
      }
      setSelectedImage(null);
      await load(false);
    } catch (nextError) {
      setError(apiErrorMessage(nextError, "Fasilitas belum dapat disimpan. Coba lagi."));
    } finally {
      setIsSaving(false);
    }
  }

  async function addUnit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!facility || !newUnitCode.trim()) {
      setError("Kode aset unit wajib diisi.");
      return;
    }
    if (newUnitCode.trim().length > 64) {
      setError("Kode aset maksimal 64 karakter.");
      return;
    }
    setSavingUnitId("new");
    setError(null);
    try {
      await request("/admin/facilities/units", { body: { assetCode: newUnitCode.trim(), facilityGroupId: facility.id }, method: "POST" });
      setNewUnitCode("");
      setIsAddUnitOpen(false);
      await load(false);
    } catch (nextError) {
      setError(apiErrorMessage(nextError, "Unit aset belum dapat ditambahkan."));
    } finally {
      setSavingUnitId(null);
    }
  }

  async function saveUnit(unit: AdminFacilityUnit) {
    const assetCode = unitDrafts[unit.id]?.trim();
    if (!assetCode) {
      setError("Kode aset unit wajib diisi.");
      return;
    }
    if (assetCode.length > 64) {
      setError("Kode aset maksimal 64 karakter.");
      return;
    }
    if (assetCode === unit.assetCode) {
      setEditingUnitId(null);
      return;
    }
    setSavingUnitId(unit.id);
    setError(null);
    try {
      await request(`/admin/facilities/units/${unit.id}`, { body: { assetCode }, method: "PATCH" });
      await load(false);
      setEditingUnitId(null);
    } catch (nextError) {
      setError(apiErrorMessage(nextError, "Kode aset belum dapat diubah."));
    } finally {
      setSavingUnitId(null);
    }
  }

  async function toggleUnit(unit: AdminFacilityUnit) {
    setSavingUnitId(unit.id);
    setError(null);
    try {
      await request(`/admin/facilities/units/${unit.id}/status`, {
        body: { status: unit.status === "ACTIVE" ? "NONACTIVE" : "ACTIVE" },
        method: "PATCH",
      });
      await load(false);
    } catch (nextError) {
      setError(apiErrorMessage(nextError, "Status unit belum dapat diubah."));
    } finally {
      setSavingUnitId(null);
    }
  }

  async function toggleFacilityStatus() {
    if (!facility || facility.facilities.length === 0) return;
    const shouldDeactivate = facility.facilities.some((unit) => unit.status === "ACTIVE");
    const nextStatus = shouldDeactivate ? "NONACTIVE" : "ACTIVE";
    const unitsToUpdate = facility.facilities.filter((unit) => unit.status !== nextStatus);

    setIsUpdatingFacilityStatus(true);
    setError(null);
    try {
      const results = await Promise.allSettled(unitsToUpdate.map((unit) => request(`/admin/facilities/units/${unit.id}/status`, {
        body: { status: nextStatus },
        method: "PATCH",
      })));
      await load(false);
      const failed = results.find((result) => result.status === "rejected");
      if (failed?.status === "rejected") {
        setError(apiErrorMessage(failed.reason, "Tidak semua unit dapat diubah statusnya. Periksa reservasi yang masih disetujui."));
      }
    } catch (nextError) {
      setError(apiErrorMessage(nextError, "Status fasilitas belum dapat diubah."));
    } finally {
      setIsUpdatingFacilityStatus(false);
    }
  }

  const imageUrl = previewUrl ?? facility?.primaryImageUrl ?? null;
  const exclusiveUnit = facility?.reservationMode === "EXCLUSIVE" ? facility.facilities[0] : undefined;
  const hasActiveUnit = facility?.facilities.some((unit) => unit.status === "ACTIVE") ?? false;
  const visibleUnits = facility?.facilities.filter((unit) => unit.status === unitStatusFilter && unit.assetCode.toLocaleLowerCase("id-ID").includes(unitQuery.trim().toLocaleLowerCase("id-ID"))) ?? [];
  const editingUnit = facility?.facilities.find((unit) => unit.id === editingUnitId) ?? null;

  return (
    <main className="admin-page admin-facility-editor-page">
      <Link className="admin-editor-back" href="/admin/facilities"><BackIcon />Kembali ke fasilitas</Link>
      {isLoading ? <p className="admin-editor-loading">Memuat detail fasilitas…</p> : null}
      {!isLoading ? <>
        <header className="admin-facility-editor-header">
          <div><p className="admin-eyebrow">{isNew ? "Fasilitas baru" : modeCopy(form.mode)}</p><h1>{isNew ? "Tambah fasilitas" : form.name || "Detail fasilitas"}</h1></div>
          {!isNew && facility ? <button className={`admin-facility-status-action${hasActiveUnit ? " is-deactivate" : " is-activate"}`} disabled={isUpdatingFacilityStatus || facility.facilities.length === 0} onClick={() => void toggleFacilityStatus()} type="button">{isUpdatingFacilityStatus ? "Memperbarui…" : hasActiveUnit ? "Nonaktifkan fasilitas" : "Aktifkan fasilitas"}</button> : null}
        </header>

        {error ? <p className="admin-master-error" role="alert">{error}</p> : null}

        <form className="admin-facility-editor" onSubmit={(event) => void saveFacility(event)}>
          <section className="admin-editor-photo-panel">
            <div className="admin-editor-photo">{imageUrl ? <img alt={`Foto ${form.name || "fasilitas"}`} src={imageUrl} /> : <div className="admin-editor-photo__empty"><PhotoPlaceholder /><span>Belum ada foto</span></div>}</div>
            <label className="admin-image-upload"><UploadIcon /><span>{imageUrl ? "Ganti foto utama" : "Unggah foto utama"}</span><input accept="image/jpeg,image/png,image/webp" onChange={(event) => changeImage(event.target.files?.[0] ?? null)} type="file" /></label>
            <p>JPEG, PNG, atau WebP · maksimal 5 MB</p>
          </section>

          <section className="admin-editor-form-panel">
            <header><h2>Informasi fasilitas</h2><p>Data ini tampil pada katalog publik.</p></header>
            <div className="admin-editor-fields">
              <label className="admin-editor-field admin-editor-field--wide"><span>Nama fasilitas</span><input maxLength={150} onChange={(event) => updateField("name", event.target.value)} placeholder="Contoh: Ruang Kelas A101" value={form.name} /></label>
              <div className="admin-editor-field"><span>Tipe fasilitas</span><FacilitySelect isOpen={openSelect === "type"} onChange={(value) => { updateField("typeId", value); setOpenSelect(null); }} onToggle={() => setOpenSelect((current) => current === "type" ? null : "type")} options={types.map((type) => ({ label: type.name, value: type.id }))} placeholder="Pilih tipe" value={form.typeId} /></div>
              <div className="admin-editor-field"><span>Area kampus</span><FacilitySelect isOpen={openSelect === "area"} onChange={(value) => { updateField("areaId", value); setOpenSelect(null); }} onToggle={() => setOpenSelect((current) => current === "area" ? null : "area")} options={areas.map((area) => ({ label: area.name, value: area.id }))} placeholder="Pilih area" value={form.areaId} /></div>
              <label className="admin-editor-field admin-editor-field--wide"><span>Lokasi detail</span><input maxLength={500} onChange={(event) => updateField("locationDetail", event.target.value)} placeholder="Contoh: Gedung A, Lantai 1, Ruang 101" value={form.locationDetail} /></label>
              <label className="admin-editor-field"><span>Kapasitas <small>(opsional)</small></span><div className="admin-capacity-input"><input inputMode="numeric" min="0" onChange={(event) => updateField("capacity", event.target.value)} placeholder="Contoh: 40" type="number" value={form.capacity} /><span>orang</span></div></label>
              <label className="admin-editor-field admin-editor-field--wide"><span>Deskripsi <small>(opsional)</small></span><textarea maxLength={500} onChange={(event) => updateField("description", event.target.value)} placeholder="Jelaskan fasilitas yang tersedia." rows={4} value={form.description} /></label>
            </div>
          </section>

          <section className="admin-editor-mode-panel">
            <header><h2>Mode reservasi</h2><p>Mode tidak dapat diubah setelah fasilitas dibuat.</p></header>
            {isNew ? <div className="admin-mode-options"><label className={form.mode === "EXCLUSIVE" ? "is-selected" : ""}><input checked={form.mode === "EXCLUSIVE"} name="reservationMode" onChange={() => updateField("mode", "EXCLUSIVE")} type="radio" /><span><strong>Ruang / area eksklusif</strong><small>Satu ruang atau area dipesan sebagai satu unit.</small></span></label><label className={form.mode === "QUANTITY" ? "is-selected" : ""}><input checked={form.mode === "QUANTITY"} name="reservationMode" onChange={() => updateField("mode", "QUANTITY")} type="radio" /><span><strong>Alat bergerak</strong><small>Beberapa unit alat fisik dalam satu katalog.</small></span></label></div> : <div className="admin-mode-static"><span className={`admin-mode-pill admin-mode-pill--${form.mode.toLowerCase()}`}>{modeCopy(form.mode)}</span></div>}
            {isNew && form.mode === "EXCLUSIVE" ? <label className="admin-editor-field admin-editor-field--asset"><span>Kode aset</span><input maxLength={64} onChange={(event) => updateField("assetCode", event.target.value)} placeholder="Contoh: RK-A101" value={form.assetCode} /></label> : null}
          </section>

          {!isNew && form.mode === "EXCLUSIVE" && exclusiveUnit ? <section className="admin-editor-unit-panel"><header><div><h2>Unit fasilitas</h2><p>Satu unit fisik untuk ruang atau area eksklusif.</p></div></header><p className="admin-unit-code">Kode aset <strong>{exclusiveUnit.assetCode}</strong></p></section> : null}

          <footer className="admin-editor-actions"><Link className="admin-secondary-button" href="/admin/facilities">Batal</Link><button className="admin-primary-button" disabled={isSaving} type="submit">{isSaving ? "Menyimpan…" : isNew ? "Buat fasilitas" : "Simpan perubahan"}</button></footer>
        </form>

        {!isNew && facility?.reservationMode === "QUANTITY" ? <section className="admin-editor-units"><header className="admin-units-header"><div><p className="admin-eyebrow">Unit fisik</p><h2>Unit aset</h2></div><div className="admin-unit-filter"><span>Filter status</span><FacilitySelect isOpen={openSelect === "unit-status"} onChange={(value) => { setUnitStatusFilter(value as "ACTIVE" | "NONACTIVE"); setOpenSelect(null); }} onToggle={() => setOpenSelect((current) => current === "unit-status" ? null : "unit-status")} options={[{ label: "Aktif", value: "ACTIVE" }, { label: "Nonaktif", value: "NONACTIVE" }]} placeholder="Aktif" value={unitStatusFilter} /></div></header><div className="admin-units-toolbar"><label className="admin-users-search"><SearchIcon /><input onChange={(event) => setUnitQuery(event.target.value)} placeholder="Cari kode aset..." type="search" value={unitQuery} /></label><button className="admin-primary-button" onClick={() => { setNewUnitCode(""); setIsAddUnitOpen(true); }} type="button"><span aria-hidden="true">+</span>Tambah unit</button></div><div className="admin-units-table-wrap"><table className="admin-units-table"><thead><tr><th>Kode aset</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{visibleUnits.length ? visibleUnits.map((unit) => <tr key={unit.id}><td><strong className="admin-unit-code-readonly">{unit.assetCode}</strong></td><td><span className={`admin-status-pill admin-status-pill--${unit.status.toLowerCase()}`}>{unit.status === "ACTIVE" ? "Aktif" : "Nonaktif"}</span></td><td><div className="admin-unit-actions"><button aria-label={`${unit.status === "ACTIVE" ? "Nonaktifkan" : "Aktifkan"} unit ${unit.assetCode}`} className="admin-master-toggle" disabled={savingUnitId === unit.id} onClick={() => void toggleUnit(unit)} type="button"><StatusToggle active={unit.status === "ACTIVE"} /></button><button aria-label={`Ubah kode aset ${unit.assetCode}`} className="admin-icon-button" disabled={savingUnitId === unit.id} onClick={() => setEditingUnitId(unit.id)} type="button"><EditIcon /></button></div></td></tr>) : <tr><td className="admin-facilities-empty" colSpan={3}>{unitQuery ? "Unit aset tidak ditemukan." : `Tidak ada unit ${unitStatusFilter === "ACTIVE" ? "aktif" : "nonaktif"}.`}</td></tr>}</tbody></table></div></section> : null}
        {isAddUnitOpen ? <div className="admin-dialog-backdrop" role="presentation"><section aria-labelledby="add-unit-title" aria-modal="true" className="admin-master-dialog" role="dialog"><header><div><p className="admin-eyebrow">Unit aset</p><h2 id="add-unit-title">Tambah unit aset</h2></div><button aria-label="Tutup" className="admin-dialog-close" onClick={() => setIsAddUnitOpen(false)} type="button"><CloseIcon /></button></header><form onSubmit={(event) => void addUnit(event)}><label>Kode aset<input autoFocus maxLength={64} onChange={(event) => setNewUnitCode(event.target.value)} placeholder="Contoh: PRJ-001" value={newUnitCode} /></label><footer><button className="admin-secondary-button" onClick={() => setIsAddUnitOpen(false)} type="button">Batal</button><button className="admin-primary-button" disabled={savingUnitId === "new"} type="submit">{savingUnitId === "new" ? "Menambah…" : "Tambah"}</button></footer></form></section></div> : null}
        {editingUnit ? <div className="admin-dialog-backdrop" role="presentation"><section aria-labelledby="edit-unit-title" aria-modal="true" className="admin-master-dialog" role="dialog"><header><div><p className="admin-eyebrow">Unit aset</p><h2 id="edit-unit-title">Ubah kode aset</h2></div><button aria-label="Tutup" className="admin-dialog-close" onClick={() => setEditingUnitId(null)} type="button"><CloseIcon /></button></header><form onSubmit={(event) => { event.preventDefault(); void saveUnit(editingUnit); }}><label>Kode aset<input autoFocus maxLength={64} onChange={(event) => setUnitDrafts((current) => ({ ...current, [editingUnit.id]: event.target.value }))} value={unitDrafts[editingUnit.id] ?? editingUnit.assetCode} /></label><footer><button className="admin-secondary-button" onClick={() => setEditingUnitId(null)} type="button">Batal</button><button className="admin-primary-button" disabled={savingUnitId === editingUnit.id} type="submit">{savingUnitId === editingUnit.id ? "Menyimpan…" : "Simpan"}</button></footer></form></section></div> : null}
      </> : null}
    </main>
  );
}
