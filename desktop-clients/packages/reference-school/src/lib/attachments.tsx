"use client";

import { FilePicker, LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { Download, Paperclip, RefreshCw, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "../ui/primitives";
import { useSchoolApi } from "./api";
import type { AttachmentContent, AttachmentPurpose, AttachmentUpload, SchoolAttachment } from "./contract";
import { useFormat } from "./format";
import { LocalizedText as ReferenceText } from '@pepbits/ops-ui';


/** Decoded size limit agreed with the server (POST /attachments rejects larger files). */
export const MAX_ATTACHMENT_BYTES = 1024 * 1024;

async function bytesOf(file: Blob): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === "function") return new Uint8Array(await file.arrayBuffer());
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error ?? new Error("The file could not be read"));
    reader.readAsArrayBuffer(file);
  });
}

/** The file's exact bytes as base64 (chunked so large files do not overflow the argument limit). */
export async function encodeFile(file: Blob): Promise<string> {
  const bytes = await bytesOf(file);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export function decodeBase64(content: string): Uint8Array {
  const binary = atob(content);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export type AttachmentItem =
  | { key: string; file: File; status: "rejected"; message: string }
  | { key: string; file: File; status: "uploading"; upload?: AttachmentUpload }
  | { key: string; file: File; status: "failed"; upload?: AttachmentUpload; message: string }
  | { key: string; file: File; status: "uploaded"; upload: AttachmentUpload; attachment: SchoolAttachment };

/**
 * Files a user attaches before committing a form, message or submission.
 *
 * Each chosen file is checked (at most 1 MB, before any request), read as its real bytes, and uploaded. A failed upload
 * keeps the original File and its encoded payload; Retry sends exactly that payload again. `ready` is false while any
 * file is uploading, failed or rejected, so the owner cannot commit until each is uploaded or removed. `clear` is for
 * the owner to call only after the server accepted the record the attachments belong to.
 */
export function useAttachmentDraft(purpose: AttachmentPurpose) {
  const api = useSchoolApi();
  const [items, setItems] = useState<AttachmentItem[]>([]);
  const seq = useRef(0);
  const put = (key: string, next: AttachmentItem | null) => setItems((all) => (next ? all.map((i) => (i.key === key ? next : i)) : all.filter((i) => i.key !== key)));

  const send = useCallback(async (key: string, file: File, upload: AttachmentUpload) => {
    put(key, { key, file, status: "uploading", upload });
    try {
      const { data } = await api.post<{ data: SchoolAttachment }>("/attachments", upload);
      put(key, { key, file, status: "uploaded", upload, attachment: data });
    } catch (e) {
      put(key, { key, file, status: "failed", upload, message: (e as Error).message });
    }
  }, [api]);

  const add = useCallback(async (file: File) => {
    const key = `f${++seq.current}`;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setItems((all) => [...all, { key, file, status: "rejected", message: "Files larger than 1 MB cannot be attached." }]);
      return;
    }
    setItems((all) => [...all, { key, file, status: "uploading" }]);
    let upload: AttachmentUpload;
    try {
      upload = { name: file.name, type: file.type || "application/octet-stream", content: await encodeFile(file), purpose };
    } catch (e) {
      put(key, { key, file, status: "failed", message: (e as Error).message });
      return;
    }
    await send(key, file, upload);
  }, [purpose, send]);

  const retry = useCallback((key: string) => {
    const item = items.find((i) => i.key === key);
    if (item?.status === "failed" && item.upload) void send(key, item.file, item.upload);
    else if (item?.status === "failed") { put(key, null); void add(item.file); }
  }, [items, send, add]);

  const remove = useCallback((key: string) => put(key, null), []);
  const clear = useCallback(() => setItems([]), []);
  const attachments = items.flatMap((i) => (i.status === "uploaded" ? [i.attachment] : []));
  const ready = items.every((i) => i.status === "uploaded");
  return { items, add, retry, remove, clear, attachments, ready, busy: items.some((i) => i.status === "uploading") };
}

export type AttachmentDraft = ReturnType<typeof useAttachmentDraft>;

/** Downloads a stored attachment through the scoped API (GET /attachments/:id, base64 JSON) as a real Blob. */
export function useAttachmentDownload() {
  const api = useSchoolApi();
  return useCallback(async (a: Pick<SchoolAttachment, "id">) => {
    const { data } = await api.get<{ data: AttachmentContent }>(`/attachments/${encodeURIComponent(a.id)}`);
    const blob = new Blob([decodeBase64(data.content) as BlobPart], { type: data.type || "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = data.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }, [api]);
}

function size(n: number, fmt: (v: number) => string) {
  return n < 1024 ? `${fmt(n)} B` : n < 1024 * 1024 ? `${fmt(Math.round(n / 102.4) / 10)} KB` : `${fmt(Math.round(n / 104857.6) / 10)} MB`;
}

/** The shared FilePicker plus the chosen files with their upload state, Retry upload and Remove. */
export function AttachmentPicker({ draft, label = "Attach files", disabled }: { draft: AttachmentDraft; label?: string; disabled?: boolean }) {
  return (
    <div className="grid gap-1.5">
      <FilePicker label={label} icon={<Paperclip className="size-4" />} disabled={disabled} onFile={(f) => void draft.add(f)} />
      <AttachmentFiles draft={draft} />
    </div>
  );
}

/** The chosen files of a draft, for layouts that place the FilePicker elsewhere (the chat composer). */
export function AttachmentFiles({ draft }: { draft: AttachmentDraft }) {
  const { t } = useLocalization();
  const { fmtNum } = useFormat();
  return (
    <>
      {draft.items.length > 0 && (
        <ul className="grid gap-1" aria-label={t("Attachments")}>
          {draft.items.map((i) => (
            <li key={i.key} className="flex items-center gap-2 rounded-md border border-line px-2 py-1 text-xs">
              <Paperclip className="size-3.5 text-faint" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{i.file.name} <span className="text-faint">· {size(i.file.size, fmtNum)}</span></span>
              <span role={i.status === "failed" || i.status === "rejected" ? "alert" : "status"} className={i.status === "failed" || i.status === "rejected" ? "text-bad" : i.status === "uploaded" ? "text-ok" : "text-muted"}>
                {i.status === "uploading" ? <LocalizedText message="Uploading…" /> : i.status === "uploaded" ? <LocalizedText message="Uploaded" /> : t(i.message)}
              </span>
              {i.status === "failed" && <Button size="xs" icon={RefreshCw} onClick={() => draft.retry(i.key)}><ReferenceText message="Retry upload" /></Button>}
              <Button size="xs" variant="ghost" icon={X} aria-label={t("Remove {name}", { name: i.file.name })} disabled={i.status === "uploading"} onClick={() => draft.remove(i.key)} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** Saved attachments with download buttons (assignment, submission and message views). */
export function AttachmentList({ attachments, className }: { attachments?: SchoolAttachment[]; className?: string }) {
  const { t } = useLocalization();
  const download = useAttachmentDownload();
  const [error, setError] = useState<string | null>(null);
  if (!attachments?.length) return null;
  return (
    <div className={className}>
      <ul className="flex flex-wrap gap-1" aria-label={t("Attachments")}>
        {attachments.map((a) => (
          <li key={a.id}>
            <Button size="xs" icon={Download} aria-label={t("Download {name}", { name: a.name })} onClick={() => { setError(null); download(a).catch((e: Error) => setError(e.message)); }}>{/* authored filename: an element, so the shared Button never translates it */}<span>{a.name}</span></Button>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="mt-1 text-[11px] text-bad">{error}</p>}
    </div>
  );
}
