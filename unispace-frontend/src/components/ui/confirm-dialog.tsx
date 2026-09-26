"use client";

import { useEffect, useRef } from "react";

export function ConfirmDialog({
  busy = false,
  children,
  confirmLabel,
  destructive = false,
  error,
  isOpen,
  onClose,
  onConfirm,
  title,
}: {
  busy?: boolean;
  children: React.ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  error?: string | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
}) {
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    dialog.current?.focus();
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [busy, isOpen, onClose]);

  if (!isOpen) return null;
  return <div className="ui-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }} role="presentation"><section aria-describedby="ui-confirm-description" aria-modal="true" aria-labelledby="ui-confirm-title" className="ui-dialog" ref={dialog} role="dialog" tabIndex={-1}><div><h2 id="ui-confirm-title">{title}</h2><div id="ui-confirm-description">{children}</div></div>{error ? <p className="ui-dialog__error" role="alert">{error}</p> : null}<footer><button disabled={busy} onClick={onClose} type="button">Batal</button><button className={destructive ? "is-destructive" : ""} disabled={busy} onClick={onConfirm} type="button">{busy ? "Memproses…" : confirmLabel}</button></footer></section></div>;
}
