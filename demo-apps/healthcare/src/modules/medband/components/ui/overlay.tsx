"use client";

import { AlertTriangle, CheckCircle2, ChevronDown, Search, X } from "@pepbits/icons";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "../../lib/utils";
import { Checkbox } from "./form";
import { SourceButton, SourceInput } from "../controls";
import { LocalizedText, useLocalization } from "@pepbits/i18n/react";
import { SourceDialog } from "@pepbits/components";
import { useReferenceHost } from "../../host";
import {useScreenHost} from "@pepbits/patterns/screen-host";
import { Copy } from "../copy";

// ─── MultiSelect ───────────────────────────────────────────────────────────

export interface MultiOption {
  value: string;
  label: string;
  group?: string;
  sub?: string;
}

export function MultiSelect({
  values,
  onChange,
  options,
  placeholder = "Any",
  searchable = true,
  ariaLabel,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  options: MultiOption[];
  placeholder?: string;
  searchable?: boolean;
  ariaLabel?: string;
}) {
  const { t: tr } = useLocalization();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const shown = options.filter((o) => !q || o.label.toLowerCase().includes(q.toLowerCase()));
  const groups = new Map<string, MultiOption[]>();
  shown.forEach((o) => groups.set(o.group ?? "", [...(groups.get(o.group ?? "") ?? []), o]));
  const toggle = (v: string) => onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  const selected = options.filter((o) => values.includes(o.value));

  return (
    <div ref={root} className="relative">
      <SourceButton
        type="button"
        aria-label={[ariaLabel&&tr(ariaLabel), selected.length?selected.slice(0,3).map(o=>tr(o.label)).join(" "):tr(placeholder),selected.length>3?tr("+{value0} more",{value0:selected.length-3}):null].filter(Boolean).join(": ")}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cx(
          "flex min-h-10 w-full items-center gap-1.5 rounded-lg border bg-paper px-2 py-1 text-left text-sm transition-colors",
          open ? "border-scrub-500 ring-2 ring-scrub-100" : "border-line hover:border-scrub-400",
        )}
      >
        <span className="flex min-w-0 flex-1 flex-wrap gap-1">
          {selected.length === 0 && <span className="px-1 text-ink-faint"><Copy>{placeholder}</Copy></span>}
          {selected.slice(0, 3).map((o) => (
            <span key={o.value} className="inline-flex items-center gap-1 rounded-md bg-scrub-50 py-0.5 pr-1 pl-2 text-[12.5px] font-medium text-scrub-800">
              <LocalizedText message={o.label ?? ""} />
              <span
                role="button"
                tabIndex={-1}
                aria-label={tr("Remove {value0}", { value0: tr(o.label ?? "") })}
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(o.value);
                }}
                className="rounded p-0.5 hover:bg-scrub-100"
              >
                <X className="size-3" />
              </span>
            </span>
          ))}
          {selected.length > 3 && <span className="px-1 text-[12.5px] font-medium text-ink-soft"><LocalizedText message="+{value0} more" values={{ value0: selected.length - 3 }} /></span>}
        </span>
        <ChevronDown className={cx("size-4 shrink-0 text-ink-faint transition-transform", open && "rotate-180")} />
      </SourceButton>

      {open && (
        <div className="animate-rise absolute z-40 mt-1.5 w-full min-w-64 overflow-hidden rounded-xl border border-line bg-paper shadow-pop">
          {searchable && (
            <div className="flex items-center gap-2 border-b border-line-soft px-3">
              <Search className="size-4 text-ink-faint" />
              <SourceInput autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter" className="h-10 flex-1 bg-transparent text-sm outline-none" />
              {values.length > 0 && (
                <SourceButton type="button" onClick={() => onChange([])} className="text-[12px] font-medium text-scrub-700 hover:underline">
                  <LocalizedText message="Clear" /></SourceButton>
              )}
            </div>
          )}
          <div className="scroll-thin max-h-64 overflow-auto p-2">
            {shown.length === 0 && <p className="px-2 py-3 text-[13px] text-ink-faint"><LocalizedText message={"Nothing matches “{value0}”."} values={{ value0: (q) ?? "" }} /></p>}
            {[...groups.entries()].map(([g, opts]) => (
              <div key={g || "all"} className="mb-1">
                {g && <p className="px-2 pt-1.5 pb-1 text-[11.5px] font-semibold text-ink-faint"><Copy>{g}</Copy></p>}
                {opts.map((o) => (
                  <div key={o.value} className="rounded-md px-2 py-1.5 hover:bg-canvas">
                    <Checkbox checked={values.includes(o.value)} onChange={() => toggle(o.value)} label={o.label} sub={o.sub} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Modal ─────────────────────────────────────────────────────────────────

/**
 * The source modal, exactly: top-aligned (10vh) panel, scrub-900 scrim with blur, rounded-2xl paper panel, shadow-pop, the
 * source header/footer rules and close button. The shared ops-ui Modal has a host skin (slate scrim, centred, bordered, its own
 * header and close button) that cannot be re-dressed from a consumer, so the source markup is kept here over the reusable SourceDialog; shared semantics provide: `role="dialog"` + `aria-modal` + accessible name, focus moves to the panel (unless a child
 * already took it), Tab/Shift+Tab stay inside, Escape closes the top-most dialog, focus returns to the opener. It renders in
 * place (inside the module root, so the scoped styles, theme and preference variables apply) and sits above the host chrome.
 * `width` keeps the source's widths.
 */

export function Modal({ open, onClose, title, children, footer, width = "max-w-lg" }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; width?: string }) {
  return (
    <SourceDialog open={open} onClose={onClose} title={title} className="fixed inset-0 z-[120] flex items-start justify-center p-4 pt-[10vh]">{panel=><>
      <div className="animate-fade absolute inset-0 bg-scrub-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div ref={panel} tabIndex={-1} className={cx("animate-rise relative w-full overflow-hidden rounded-2xl bg-paper shadow-pop outline-none", width)}>
        <div className="flex items-center justify-between border-b border-line-soft px-5 py-3.5">
          <h2 className="text-[15px] font-semibold"><LocalizedText message={title} /></h2>
          <SourceButton onClick={onClose} aria-label="Close" className="rounded-md p-1 text-ink-faint hover:bg-canvas hover:text-ink">
            <X className="size-4" />
          </SourceButton>
        </div>
        <div className="scroll-thin max-h-[65vh] overflow-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line-soft bg-canvas/50 px-5 py-3">{footer}</div>}
      </div>
    </>}</SourceDialog>
  );
}

// ─── Toast ─────────────────────────────────────────────────────────────────

export function ToastProvider({children}:{children:ReactNode}) {return <>{children}</>;}
export function useToast(){
 const {notify}=useScreenHost(),{t}=useLocalization();
 return useCallback((notice:{title:string;body?:string;tone?:"success"|"error"})=>notify([t(notice.title),notice.body&&t(notice.body)].filter(Boolean).join(" — "),{tone:notice.tone??"success"}),[notify,t]);
}

/** Shows a server or network failure as an error toast. Server messages pass through the catalog unchanged unless it knows them. */
export function useErrorToast() {
  const toast = useToast();
  return useCallback((err: unknown, title = "Could not save") => {
    if ((err as { name?: string } | null)?.name === "AbortError") return;
    toast({ title, body: (err as Error)?.message ?? String(err), tone: "error" });
  }, [toast]);
}
