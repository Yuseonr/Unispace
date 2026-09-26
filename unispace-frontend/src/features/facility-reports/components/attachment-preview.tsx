"use client";
/* eslint-disable @next/next/no-img-element -- authenticated object URLs cannot use Next image optimization. */

import { useEffect, useState } from "react";

import { useAuth } from "@/features/auth/auth-provider";
import type { ReportAttachment } from "../api";

export function AttachmentPreview({ attachment }: { attachment: ReportAttachment }) {
  const { fetchFile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    let objectUrl: string | null = null;
    fetchFile(attachment.downloadUrl)
      .then((file) => {
        objectUrl = URL.createObjectURL(file.blob);
        if (active) setUrl(objectUrl);
      })
      .catch(() => { if (active) setError("Foto tidak dapat dimuat."); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [attachment.downloadUrl, fetchFile, isOpen]);

  return <>
    <button className="report-attachment" onClick={() => { setError(null); setUrl(null); setIsOpen(true); }} type="button"><span aria-hidden="true">▧</span><span><strong>{attachment.originalFilename}</strong><small>{Math.ceil(attachment.sizeBytes / 1024)} KB</small></span></button>
    {isOpen ? <div className="attachment-lightbox" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsOpen(false); }} role="presentation"><section aria-label={`Preview ${attachment.originalFilename}`} className="attachment-lightbox__dialog" role="dialog"><button aria-label="Tutup preview" onClick={() => setIsOpen(false)} type="button">×</button>{error ? <p role="alert">{error}</p> : url ? <img alt={`Bukti laporan: ${attachment.originalFilename}`} src={url} /> : <p role="status">Memuat foto privat…</p>}</section></div> : null}
  </>;
}
