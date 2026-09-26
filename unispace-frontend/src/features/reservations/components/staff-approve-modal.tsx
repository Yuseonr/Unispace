"use client";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";

import { formatDateOnlyIndonesian, formatSlotTime } from "../api";
import type { StaffReservationItem } from "../types";

export type StaffApproveModalProps = {
  error: string | null;
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  reservation: StaffReservationItem | null;
};

export function StaffApproveModal({ error, isOpen, isSubmitting, onClose, onConfirm, reservation }: StaffApproveModalProps) {
  if (!reservation) return null;
  const target = reservation.facility?.name ?? reservation.facilityGroup?.name ?? "Fasilitas kampus";
  const isExclusive = Boolean(reservation.facilityId);
  const date = formatDateOnlyIndonesian(reservation.usageDate.split("T")[0] ?? "");
  const time = `${formatSlotTime(reservation.startTime)}–${formatSlotTime(reservation.endTime)} WIB`;

  return <ConfirmDialog busy={isSubmitting} confirmLabel="Setujui reservasi" error={error} isOpen={isOpen} onClose={onClose} onConfirm={() => void onConfirm()} title="Setujui permohonan reservasi"><p><strong>{reservation.user.name}</strong> mengajukan {target} pada {date}, {time}.</p><p>{isExclusive ? "Backend akan memeriksa kembali bentrok slot sebelum persetujuan disimpan." : `Backend akan memilih dan mengalokasikan ${reservation.requestedQuantity} unit alat yang benar-benar tersedia pada seluruh slot. Petugas tidak memilih kode aset secara manual.`}</p><p>Pengajuan pending lain yang tidak lagi dapat dipenuhi akan ditangani backend sesuai aturan konflik.</p></ConfirmDialog>;
}
