import { useEffect, useRef, useState } from "react";
import { CircleAlert, CircleCheck, FileUp, LoaderCircle } from "lucide-react";
import { cn } from "../cn";
import { readHostError } from "../registration";
import { Button } from "../ui/Button";

export const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;
export const DOCUMENT_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
};
const EXTENSIONS = /\.(pdf|png|jpe?g)$/i;

/** Client-side check before upload. The host must still validate the file on the server. */
export function validateDocumentFile(file: Pick<File, "name" | "size" | "type">): string | null {
  const typeOk = file.type ? file.type in DOCUMENT_TYPES : EXTENSIONS.test(file.name);
  if (!typeOk) return "Upload a PDF, PNG or JPEG file.";
  if (file.size > MAX_DOCUMENT_BYTES) return "The file is larger than 2 MB. Upload a smaller file.";
  if (file.size === 0) return "The file is empty.";
  return null;
}

type RowState = { status: "idle" } | { status: "uploading" } | { status: "error"; message: string };

export function DocumentsStage({
  documents,
  labelFor,
  uploadDocument,
  uploaded,
  onUploaded,
  onSubmit,
  submitting,
  submitError,
  onBack,
}: {
  documents: string[];
  labelFor: (type: string) => string;
  uploadDocument: (type: string, file: File) => Promise<void>;
  /** Document type -> uploaded file name. Held by the wizard so a retry does not re-upload. */
  uploaded: Record<string, string>;
  onUploaded: (type: string, fileName: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  submitError: string | null;
  onBack: () => void;
}) {
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const headingRef = useRef<HTMLHeadingElement>(null);
  const done = documents.every((t) => uploaded[t]);
  const busy = Object.values(rows).some((r) => r.status === "uploading");

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  async function choose(type: string, file: File | undefined, input: HTMLInputElement) {
    if (!file) return;
    const problem = validateDocumentFile(file);
    if (problem) {
      setRows((r) => ({ ...r, [type]: { status: "error", message: problem } }));
      input.value = "";
      return;
    }
    setRows((r) => ({ ...r, [type]: { status: "uploading" } }));
    try {
      await uploadDocument(type, file);
      onUploaded(type, file.name);
      setRows((r) => ({ ...r, [type]: { status: "idle" } }));
    } catch (err) {
      const e = readHostError(err, "The upload failed. Try again.");
      setRows((r) => ({ ...r, [type]: { status: "error", message: e.message } }));
    } finally {
      input.value = "";
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl animate-step-in py-6 lg:py-10">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-scrub-700 text-white">
        <FileUp className="h-6 w-6" aria-hidden="true" />
      </span>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mt-5 font-display text-[2rem] font-semibold leading-[1.05] tracking-[-0.025em] text-ink-900 focus:outline-none sm:text-[2.5rem]"
      >
        Upload documents
      </h1>
      <p className="mt-2.5 leading-relaxed text-ink-600">
        Your plan requires the documents below. Each must be a PDF, PNG or JPEG file of 2 MB or less.
      </p>

      {submitError && (
        <div role="alert" className="mt-5 flex animate-shake items-start gap-3 rounded-2xl border border-signal/25 bg-[#FFF5F5] px-4 py-3 text-sm text-signal">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p className="leading-relaxed">{submitError}</p>
        </div>
      )}

      <ul className="mt-7 space-y-3">
        {documents.map((type) => {
          const row = rows[type] ?? { status: "idle" };
          const id = `documents.${type}`;
          const error = row.status === "error" ? row.message : null;
          const name = uploaded[type];
          return (
            <li
              key={type}
              className={cn("rounded-2xl border bg-white p-4", error ? "border-signal/40" : name ? "border-scrub-300" : "border-ink-200")}
            >
              <div className="flex items-start justify-between gap-3">
                <label htmlFor={id} className="font-semibold text-ink-900">
                  {labelFor(type)}
                </label>
                {row.status === "uploading" ? (
                  <span role="status" className="flex items-center gap-1.5 text-sm text-ink-500">
                    <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Uploading
                  </span>
                ) : name ? (
                  <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-scrub-700">
                    <CircleCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">Uploaded {name}</span>
                  </span>
                ) : null}
              </div>
              <input
                id={id}
                type="file"
                accept="application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg"
                disabled={row.status === "uploading" || submitting}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${id}-error` : undefined}
                onChange={(e) => void choose(type, e.target.files?.[0], e.currentTarget)}
                className="mt-3 block w-full text-sm text-ink-700 file:mr-3 file:h-9 file:cursor-pointer file:rounded-xl file:border-0 file:bg-ink-100 file:px-3.5 file:text-sm file:font-semibold file:text-ink-900 hover:file:bg-ink-200 disabled:opacity-60"
              />
              {error && (
                <p id={`${id}-error`} className="mt-2 flex animate-fade-in items-start gap-1.5 text-[0.8rem] font-medium text-signal">
                  <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {error}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" onClick={onBack} disabled={submitting || busy}>
          Back to review
        </Button>
        <Button size="lg" onClick={onSubmit} disabled={!done || busy} loading={submitting} className="min-w-[9.5rem]">
          {submitting ? "Submitting" : "Submit registration"}
        </Button>
      </div>
    </div>
  );
}
