"use client";

import { useEffect, useId, useMemo, useState } from "react";

import {
  addOperationalDays,
  fetchSlotAvailability,
  formatDateIndonesian,
  formatJakartaDate,
  getJakartaDayOfWeek,
  getReservationDateBounds,
  isOperationalDay,
} from "../api";
import type {
  FacilityAvailabilityData,
  ReservationMode,
  SlotItem,
} from "../types";

export type SlotPickerProps = {
  facilityGroupId?: string;
  facilityId?: string;
  facilityName?: string;
  initialDate?: string;
  mode?: "select" | "view";
  onDateChange?: (date: string) => void;
  onSlotSelect?: (startTime: string | null, endTime: string | null, slotCount: number) => void;
  requestedQuantity?: number;
  reservationMode?: ReservationMode;
  selectedEndTime?: string | null;
  selectedStartTime?: string | null;
};

export function SlotPicker({
  facilityGroupId,
  facilityId,
  facilityName,
  initialDate,
  mode = "view",
  onDateChange,
  onSlotSelect,
  requestedQuantity = 1,
  reservationMode = "EXCLUSIVE",
  selectedEndTime = null,
  selectedStartTime = null,
}: SlotPickerProps) {
  const dateInputId = useId();
  const bounds = useMemo(() => getReservationDateBounds(), []);

  // Pastikan tanggal default berada di hari kerja operasional minimal H-2
  const initialValidDate = useMemo(() => {
    if (initialDate && initialDate >= bounds.minDate && initialDate <= bounds.maxDate) {
      return initialDate;
    }
    return bounds.minDate;
  }, [bounds.maxDate, bounds.minDate, initialDate]);

  const [currentDate, setCurrentDate] = useState<string>(initialValidDate);
  const [data, setData] = useState<FacilityAvailabilityData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Indeks seleksi slot internal (0 - 25)
  const [internalStartIdx, setInternalStartIdx] = useState<number | null>(null);
  const [internalEndIdx, setInternalEndIdx] = useState<number | null>(null);

  // Hitung rentang aktif (prioritaskan props eksternal jika ada)
  const { endIdx, startIdx } = useMemo(() => {
    if (!data?.slots) return { endIdx: null, startIdx: null };
    if (selectedStartTime) {
      const s = data.slots.findIndex((slot) => slot.startTime === selectedStartTime);
      if (s !== -1) {
        if (selectedEndTime) {
          const e = data.slots.findIndex((slot) => slot.endTime === selectedEndTime);
          return { endIdx: e !== -1 ? e : s, startIdx: s };
        }
        return { endIdx: s, startIdx: s };
      }
    }
    return { endIdx: internalEndIdx, startIdx: internalStartIdx };
  }, [data, internalEndIdx, internalStartIdx, selectedEndTime, selectedStartTime]);

  useEffect(() => {
    let isMounted = true;
    if (!facilityId && !facilityGroupId) return;

    fetchSlotAvailability({
      facilityGroupId,
      facilityId,
      usageDate: currentDate,
    })
      .then((res) => {
        if (!isMounted) return;
        setData(res);
        setError(null);
      })
      .catch(() => {
        if (isMounted) {
          setError("Gagal memuat ketersediaan slot. Silakan periksa koneksi atau coba tanggal lain.");
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currentDate, facilityGroupId, facilityId]);

  function handleDateChange(newDate: string) {
    setCurrentDate(newDate);
    setInternalStartIdx(null);
    setInternalEndIdx(null);
    setLoading(true);
    onSlotSelect?.(null, null, 0);
    onDateChange?.(newDate);
  }

  function handlePrevDay() {
    const cur = new Date(`${currentDate}T12:00:00+07:00`);
    cur.setDate(cur.getDate() - 1);
    while (getJakartaDayOfWeek(formatJakartaDate(cur)) === 0 || getJakartaDayOfWeek(formatJakartaDate(cur)) === 6) {
      cur.setDate(cur.getDate() - 1);
    }
    const target = formatJakartaDate(cur);
    if (target >= bounds.minDate) {
      handleDateChange(target);
    }
  }

  function handleNextDay() {
    const nextDate = addOperationalDays(currentDate, 1);
    if (nextDate <= bounds.maxDate) {
      handleDateChange(nextDate);
    }
  }

  function isSlotAvailable(slot: SlotItem): boolean {
    if (!slot.available) return false;
    if (reservationMode === "QUANTITY" && typeof slot.availableUnits === "number") {
      return slot.availableUnits >= requestedQuantity;
    }
    return true;
  }

  function handleSlotClick(index: number) {
    if (mode !== "select" || !data?.slots) return;
    const clickedSlot = data.slots[index];
    if (!isSlotAvailable(clickedSlot)) return;

    if (startIdx === null || endIdx !== null) {
      // Memulai pilihan baru
      setInternalStartIdx(index);
      setInternalEndIdx(null);
      onSlotSelect?.(clickedSlot.startTime, clickedSlot.endTime, 1);
    } else {
      // Sudah ada startIdx, pengguna memilih slot kedua
      if (index < startIdx) {
        // Klik slot sebelum startIdx -> ubah startIdx ke slot yang baru
        setInternalStartIdx(index);
        setInternalEndIdx(null);
        onSlotSelect?.(clickedSlot.startTime, clickedSlot.endTime, 1);
      } else if (index === startIdx) {
        // Klik slot yang sama -> kunci rentang 1 slot
        setInternalEndIdx(index);
        onSlotSelect?.(clickedSlot.startTime, clickedSlot.endTime, 1);
      } else {
        // Cek apakah seluruh slot di antara startIdx dan index tersedia
        const range = data.slots.slice(startIdx, index + 1);
        const allAvailable = range.every((s) => isSlotAvailable(s));

        if (allAvailable) {
          setInternalEndIdx(index);
          onSlotSelect?.(
            data.slots[startIdx].startTime,
            clickedSlot.endTime,
            index - startIdx + 1,
          );
        } else {
          // Ada slot bentrok di tengah -> jadikan slot baru sebagai start
          setInternalStartIdx(index);
          setInternalEndIdx(null);
          onSlotSelect?.(clickedSlot.startTime, clickedSlot.endTime, 1);
        }
      }
    }
  }

  function handleResetSelection() {
    setInternalStartIdx(null);
    setInternalEndIdx(null);
    onSlotSelect?.(null, null, 0);
  }

  const selectedRangeSummary = useMemo(() => {
    if (startIdx === null || !data?.slots) return null;
    const effectiveEnd = endIdx !== null ? endIdx : startIdx;
    const startStr = data.slots[startIdx].startTime;
    const endStr = data.slots[effectiveEnd].endTime;
    const count = effectiveEnd - startIdx + 1;
    const hours = (count * 0.5).toFixed(count % 2 === 0 ? 0 : 1);

    return {
      count,
      endStr,
      hours,
      startStr,
    };
  }, [data, endIdx, startIdx]);

  const isCurrentOperDay = isOperationalDay(currentDate);

  return (
    <div className="slot-picker">
      <div className="slot-picker__header">
        <div className="slot-picker__title-group">
          <span className="slot-picker__label">Kalender Slot Waktu</span>
          {facilityName ? <h3 className="slot-picker__facility">{facilityName}</h3> : null}
          <p className="slot-picker__desc">
            {mode === "select"
              ? "Pilih slot awal lalu slot akhir berurutan untuk durasi peminjaman (07.00 – 20.00 WIB)."
              : "Ketersediaan 26 slot 30 menit per tanggal pada hari operasional kampus."}
          </p>
        </div>

        <div className="slot-picker__date-nav">
          <button
            aria-label="Hari operasional sebelumnya"
            className="slot-picker__nav-btn"
            disabled={currentDate <= bounds.minDate}
            onClick={handlePrevDay}
            type="button"
          >
            ←
          </button>

          <div className="slot-picker__date-input-wrap">
            <label className="sr-only" htmlFor={dateInputId}>
              Pilih tanggal pemakaian
            </label>
            <input
              className="slot-picker__date-input"
              id={dateInputId}
              max={bounds.maxDate}
              min={bounds.minDate}
              onChange={(e) => handleDateChange(e.target.value)}
              type="date"
              value={currentDate}
            />
            <span className="slot-picker__date-display">
              {formatDateIndonesian(currentDate)}
            </span>
          </div>

          <button
            aria-label="Hari operasional berikutnya"
            className="slot-picker__nav-btn"
            disabled={currentDate >= bounds.maxDate}
            onClick={handleNextDay}
            type="button"
          >
            →
          </button>
        </div>
      </div>

      {!isCurrentOperDay ? (
        <div className="slot-picker__alert slot-picker__alert--warning">
          <strong>Hari Libur Operasional:</strong> Fasilitas kampus hanya beroperasi pada hari kerja (Senin s.d. Jumat). Silakan pilih tanggal kerja berikutnya.
        </div>
      ) : null}

      {/* Baris Ringkasan Pilihan di Mode Select */}
      {mode === "select" && selectedRangeSummary ? (
        <div className="slot-picker__summary-bar">
          <div className="slot-picker__summary-content">
            <span className="slot-picker__summary-badge">Slot Terpilih</span>
            <strong>
              {selectedRangeSummary.startStr} – {selectedRangeSummary.endStr} WIB
            </strong>
            <span className="slot-picker__summary-meta">
              ({selectedRangeSummary.count} slot · {selectedRangeSummary.hours} jam)
            </span>
          </div>
          <button
            className="slot-picker__reset-btn"
            onClick={handleResetSelection}
            type="button"
          >
            Batal Pilihan
          </button>
        </div>
      ) : null}

      {/* Legenda Indikator */}
      <div className="slot-picker__legend">
        <span className="slot-legend-item">
          <span className="slot-dot slot-dot--available" /> Tersedia
        </span>
        {mode === "select" ? (
          <span className="slot-legend-item">
            <span className="slot-dot slot-dot--selected" /> Terpilih
          </span>
        ) : null}
        <span className="slot-legend-item">
          <span className="slot-dot slot-dot--booked" /> Terisi / Habis
        </span>
        <span className="slot-legend-item">
          <span className="slot-dot slot-dot--maintenance" /> Pemeliharaan
        </span>
      </div>

      {loading ? (
        <div className="slot-picker__loading" role="status">
          <span className="slot-picker__spinner" />
          <span>Memuat status 26 slot ketersediaan…</span>
        </div>
      ) : error ? (
        <div className="slot-picker__alert slot-picker__alert--error">
          <p>{error}</p>
          <button
            className="slot-picker__retry-btn"
            onClick={() => {
              setLoading(true);
              setError(null);
              fetchSlotAvailability({
                facilityGroupId,
                facilityId,
                usageDate: currentDate,
              })
                .then(setData)
                .catch(() => setError("Gagal memuat ketersediaan slot. Silakan coba lagi."))
                .finally(() => setLoading(false));
            }}
            type="button"
          >
            Coba Lagi
          </button>
        </div>
      ) : (
        <div className="slot-picker__grid" role={mode === "select" ? "group" : undefined}>
          {data?.slots?.map((slot, index) => {
            const available = isSlotAvailable(slot);
            const isStart = startIdx === index;
            const isEnd = endIdx === index;
            const isInRange =
              startIdx !== null &&
              endIdx !== null &&
              index > startIdx &&
              index < endIdx;
            const isSingleSelected = startIdx === index && endIdx === null;

            let stateClass = "is-available";
            if (!slot.available) {
              stateClass =
                slot.reason === "MAINTENANCE"
                  ? "is-maintenance"
                  : slot.reason === "NON_OPERATIONAL_DAY"
                    ? "is-holiday"
                    : "is-booked";
            } else if (!available) {
              // Tersedia tapi kuantitas kurang
              stateClass = "is-insufficient";
            }

            if (isStart || isEnd || isSingleSelected) {
              stateClass += " is-selected";
            } else if (isInRange) {
              stateClass += " is-in-range";
            }

            const slotLabel = `${slot.startTime} - ${slot.endTime}`;
            let statusText = "Tersedia";
            if (slot.reason === "MAINTENANCE") statusText = "Pemeliharaan";
            else if (slot.reason === "BOOKED") statusText = "Terisi";
            else if (slot.reason === "NON_OPERATIONAL_DAY") statusText = "Libur";
            else if (reservationMode === "QUANTITY" && typeof slot.availableUnits === "number") {
              statusText = `${slot.availableUnits} unit`;
            }

            return (
              <button
                aria-label={`Slot ${slotLabel}: ${statusText}${isStart || isEnd || isSingleSelected ? " (Terpilih)" : ""}`}
                aria-pressed={mode === "select" ? isStart || isEnd || isSingleSelected || isInRange : undefined}
                className={`slot-card ${stateClass}`}
                disabled={mode !== "select" || !available}
                key={slot.slotIndex}
                onClick={() => handleSlotClick(index)}
                type="button"
              >
                <span className="slot-card__time">{slotLabel}</span>
                <span className="slot-card__status">{statusText}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
