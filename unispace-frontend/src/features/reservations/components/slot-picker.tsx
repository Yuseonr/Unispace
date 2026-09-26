"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import {
  fetchSlotAvailability,
  formatDateIndonesian,
  getAvailableOperationalDates,
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
  onAvailabilityChange?: (availability: FacilityAvailabilityData | null) => void;
  onSlotSelect?: (startTime: string | null, endTime: string | null, slotCount: number) => void;
  requestedQuantity?: number;
  reservationMode?: ReservationMode;
  selectedEndTime?: string | null;
  selectedStartTime?: string | null;
};

export function SlotPicker({
  facilityGroupId,
  facilityId,
  initialDate,
  mode = "view",
  onDateChange,
  onAvailabilityChange,
  onSlotSelect,
  requestedQuantity = 1,
  reservationMode = "EXCLUSIVE",
  selectedEndTime = null,
  selectedStartTime = null,
}: SlotPickerProps) {
  const dateInputId = useId();
  const availableDates = useMemo(() => getAvailableOperationalDates(), []);

  // Pastikan tanggal default berada di hari kerja operasional minimal H-2
  const initialValidDate = useMemo(() => {
    if (initialDate && availableDates.some((d) => d.value === initialDate)) {
      return initialDate;
    }
    return availableDates[0]?.value ?? "";
  }, [availableDates, initialDate]);

  const [currentDate, setCurrentDate] = useState<string>(initialValidDate);
  const [data, setData] = useState<FacilityAvailabilityData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Indeks seleksi slot internal (0 - 25)
  const [internalStartIdx, setInternalStartIdx] = useState<number | null>(null);
  const [internalEndIdx, setInternalEndIdx] = useState<number | null>(null);
  const [isLocked, setIsLocked] = useState<boolean>(false);

  // Status popover custom dropdown tanggal operasional
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDropdownOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDropdownOpen]);

  const selectedDateOption = useMemo(() => {
    return availableDates.find((d) => d.value === currentDate) ?? null;
  }, [availableDates, currentDate]);

  // Beritahu parent tentang tanggal awal yang aktif jika tidak diberikan initialDate
  const hasNotifiedInitialRef = useRef(false);
  useEffect(() => {
    if (!hasNotifiedInitialRef.current) {
      hasNotifiedInitialRef.current = true;
      if (!initialDate && initialValidDate) {
        onDateChange?.(initialValidDate);
      }
    }
  }, [initialDate, initialValidDate, onDateChange]);

  // Sinkronisasi tanggal ketika initialDate berubah dari luar
  const [prevInitialDateProp, setPrevInitialDateProp] = useState(initialDate);
  if (initialDate !== prevInitialDateProp) {
    setPrevInitialDateProp(initialDate);
    if (initialDate && availableDates.some((d) => d.value === initialDate) && initialDate !== currentDate) {
      setCurrentDate(initialDate);
      setInternalStartIdx(null);
      setInternalEndIdx(null);
      setIsLocked(false);
      setLoading(true);
    }
  }

  // Sinkronisasi reset ketika props waktu dihapus dari luar
  const [prevStartTimeProp, setPrevStartTimeProp] = useState(selectedStartTime);
  if (selectedStartTime !== prevStartTimeProp) {
    setPrevStartTimeProp(selectedStartTime);
    if (!selectedStartTime) {
      setInternalStartIdx(null);
      setInternalEndIdx(null);
      setIsLocked(false);
    }
  }

  // Hitung rentang aktif (prioritaskan state pemilihan internal saat user berinteraksi)
  const { endIdx, startIdx } = useMemo(() => {
    if (!data?.slots) return { endIdx: null, startIdx: null };
    if (internalStartIdx !== null) {
      return { endIdx: internalEndIdx, startIdx: internalStartIdx };
    }
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
    return { endIdx: null, startIdx: null };
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
        onAvailabilityChange?.(res);
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
  }, [currentDate, facilityGroupId, facilityId, onAvailabilityChange]);

  function handleDateChange(newDate: string) {
    setCurrentDate(newDate);
    setInternalStartIdx(null);
    setInternalEndIdx(null);
    setIsLocked(false);
    onAvailabilityChange?.(null);
    setLoading(true);
    onSlotSelect?.(null, null, 0);
    onDateChange?.(newDate);
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

    // Kasus 1: Keduanya (Start & End) sudah terpilih / terkunci
    if (startIdx !== null && endIdx !== null) {
      if (index === startIdx) {
        // Klik slot START -> Batalkan seluruh pilihan (start dan end batal)
        handleResetSelection();
        return;
      }
      if (index === endIdx) {
        // Klik slot END -> Batalkan slot end saja, kembali ke pemilihan end
        setInternalEndIdx(null);
        setIsLocked(false);
        onSlotSelect?.(data.slots[startIdx].startTime, data.slots[startIdx].endTime, 1);
        return;
      }
      // Slot lainnya saat terkunci tidak dapat diklik (abaikan)
      return;
    }

    // Kasus 2: Baru memilih Start (startIdx !== null && endIdx === null)
    if (startIdx !== null && endIdx === null) {
      if (index === startIdx) {
        // Klik slot yang sama lagi -> Batalkan pilihan itu
        handleResetSelection();
        return;
      }

      if (!isSlotAvailable(clickedSlot)) return;

      if (index > startIdx) {
        // Cek apakah seluruh slot di antara startIdx dan index tersedia
        const range = data.slots.slice(startIdx, index + 1);
        const allAvailable = range.every((s) => isSlotAvailable(s));

        if (allAvailable) {
          setInternalEndIdx(index);
          setIsLocked(true);
          onSlotSelect?.(
            data.slots[startIdx].startTime,
            clickedSlot.endTime,
            index - startIdx + 1,
          );
        } else {
          // Ada slot bentrok di tengah jalan -> jadikan slot baru sebagai start
          setInternalStartIdx(index);
          setInternalEndIdx(null);
          setIsLocked(false);
          onSlotSelect?.(clickedSlot.startTime, clickedSlot.endTime, 1);
        }
        return;
      }

      // Klik slot sebelum startIdx -> ubah slot awal menjadi slot baru
      setInternalStartIdx(index);
      setInternalEndIdx(null);
      setIsLocked(false);
      onSlotSelect?.(clickedSlot.startTime, clickedSlot.endTime, 1);
      return;
    }

    // Kasus 3: Belum ada slot terpilih (startIdx === null)
    if (!isSlotAvailable(clickedSlot)) return;
    setInternalStartIdx(index);
    setInternalEndIdx(null);
    setIsLocked(false);
    onSlotSelect?.(clickedSlot.startTime, clickedSlot.endTime, 1);
  }

  function handleResetSelection() {
    setInternalStartIdx(null);
    setInternalEndIdx(null);
    setIsLocked(false);
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
      isLocked,
      startStr,
    };
  }, [data, endIdx, isLocked, startIdx]);

  const isCurrentOperDay = isOperationalDay(currentDate);

  return (
    <div className="slot-picker">
      <div className="slot-picker__header">
        <div className="slot-picker__title-group">
          <h2 className="slot-picker__heading">Jadwal & ketersediaan slot waktu</h2>
        </div>

        <div className="slot-picker__date-select-wrap" ref={dropdownRef}>
          <span className="slot-picker__date-select-label" id={`${dateInputId}-label`}>
            Pilih Tanggal Penggunaan
          </span>
          <div className="slot-picker__dropdown">
            <button
              aria-expanded={isDropdownOpen}
              aria-haspopup="listbox"
              aria-labelledby={`${dateInputId}-label`}
              className={`slot-picker__dropdown-trigger ${isDropdownOpen ? "is-open" : ""}`}
              id={dateInputId}
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              type="button"
            >
              <div className="slot-picker__dropdown-trigger-left">
                <span className="slot-picker__dropdown-icon" aria-hidden="true">
                  <svg fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
                    <rect height="18" rx="3" width="18" x="3" y="4" />
                    <line x1="16" x2="16" y1="2" y2="6" />
                    <line x1="8" x2="8" y1="2" y2="6" />
                    <line x1="3" x2="21" y1="10" y2="10" />
                  </svg>
                </span>
                <span className="slot-picker__dropdown-caption">
                  {selectedDateOption
                    ? `${selectedDateOption.dayName}, ${selectedDateOption.formattedDate}`
                    : formatDateIndonesian(currentDate)}
                </span>
              </div>

              <div className="slot-picker__dropdown-trigger-right">
                <span className={`slot-picker__dropdown-arrow ${isDropdownOpen ? "is-open" : ""}`} aria-hidden="true">
                  <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" viewBox="0 0 24 24" width="16">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
              </div>
            </button>

            {isDropdownOpen ? (
              <div
                aria-labelledby={`${dateInputId}-label`}
                className="slot-picker__dropdown-menu"
                role="listbox"
              >
                <div className="slot-picker__dropdown-menu-hint">
                  <span className="slot-picker__dropdown-hint-title">Pilihan Hari Operasional Kampus</span>
                  <span className="slot-picker__dropdown-hint-sub">Senin – Jumat · 07.00 – 20.00 WIB</span>
                </div>

                <div className="slot-picker__dropdown-list">
                  {availableDates.map((item) => {
                    const isSelected = item.value === currentDate;
                    return (
                      <button
                        aria-selected={isSelected}
                        className={`slot-picker__dropdown-item ${isSelected ? "is-selected" : ""}`}
                        key={item.value}
                        onClick={() => {
                          handleDateChange(item.value);
                          setIsDropdownOpen(false);
                        }}
                        role="option"
                        type="button"
                      >
                        <div className="slot-picker__dropdown-item-main">
                          <span className="slot-picker__dropdown-day-badge">
                            {item.dayShort}
                          </span>
                          <div className="slot-picker__dropdown-item-details">
                            <span className="slot-picker__dropdown-item-day">
                              {item.dayName}
                            </span>
                            <span className="slot-picker__dropdown-item-date">
                              {item.formattedDate}
                            </span>
                          </div>
                        </div>

                        <div className="slot-picker__dropdown-item-aside">
                          {isSelected ? (
                            <span className="slot-picker__dropdown-check" aria-hidden="true">
                              <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24" width="16">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
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
            <span className="slot-picker__summary-badge">
              {isLocked ? "Slot Terkunci" : "Pilih Jam Selesai"}
            </span>
            <strong>
              {selectedRangeSummary.startStr} – {selectedRangeSummary.endStr} WIB
            </strong>
            {!isLocked ? (
              <span className="slot-picker__summary-hint">
                · Klik slot akhir atau pesan slot ini saja
              </span>
            ) : null}
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
        <span className="slot-legend-item">
          <span className="slot-dot slot-dot--booked" /> Tidak Tersedia
        </span>
        <span className="slot-legend-item">
          <span className="slot-dot slot-dot--maintenance" /> Pemeliharaan
        </span>
        <span className="slot-legend-item">
          <span className="slot-dot slot-dot--selected" /> Dipilih
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
                .then((availability) => {
                  setData(availability);
                  onAvailabilityChange?.(availability);
                })
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

            // Logika slot non-aktif / abu-abu (locked out):
            // 1. Jika start & end sudah terkunci (isLocked): semua slot di luar rentang startIdx..endIdx
            // 2. Jika baru memilih jam mulai (!isLocked && startIdx !== null): semua slot sebelum startIdx
            const isLockedOut =
              mode === "select" &&
              startIdx !== null &&
              ((isLocked && (index < startIdx || (endIdx !== null && index > endIdx))) ||
                (!isLocked && index < startIdx));

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
            } else if (isLockedOut) {
              stateClass += " is-locked-out";
            }

            const slotLabel = `${slot.startTime} - ${slot.endTime}`;
            let statusText = "Tersedia";
            if (slot.reason === "MAINTENANCE") statusText = "Pemeliharaan";
            else if (slot.reason === "BOOKED") statusText = "Tidak Tersedia";
            else if (slot.reason === "NON_OPERATIONAL_DAY") statusText = "Libur";
            else if (reservationMode === "QUANTITY" && typeof slot.availableUnits === "number") {
              statusText = `${slot.availableUnits} unit`;
            }

            // Saat terkunci, slot start dan slot end TETAP BISA DIKLIK untuk membatalkan pilihan
            const isClickableWhenLocked =
              isLocked && (index === startIdx || index === endIdx);

            const isDisabled =
              mode !== "select" ||
              !available ||
              (isLockedOut && !isClickableWhenLocked) ||
              (isLocked && !isClickableWhenLocked);

            let ariaActionHint = "";
            if (isStart && endIdx !== null) {
              ariaActionHint = " (Mulai - Klik untuk membatalkan seluruh pilihan)";
            } else if (isEnd && endIdx !== null && startIdx !== endIdx) {
              ariaActionHint = " (Selesai - Klik untuk membatalkan jam selesai)";
            } else if (isStart || isSingleSelected) {
              ariaActionHint = " (Mulai - Klik lagi untuk membatalkan)";
            }

            return (
              <button
                aria-label={`Slot ${slotLabel}: ${statusText}${ariaActionHint}`}
                aria-pressed={mode === "select" ? isStart || isEnd || isSingleSelected || isInRange : undefined}
                className={`slot-card ${stateClass}`}
                disabled={isDisabled}
                key={slot.slotIndex}
                onClick={() => handleSlotClick(index)}
                type="button"
              >
                <span className="slot-card__time">{slotLabel}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
