"use client";
import { CornerDownLeft, History, Inbox, LayoutDashboard, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { cx } from "../../lib/cx";
import { Icon } from "../../lib/icons";
import { useRouter } from "../../lib/navigation";
import { tenantAdminPaths } from "../../routes";
import { SourceButton, SourceInput } from "../ui/controls";
import { useApp } from "./context";

interface Entry { key: string; label: string; group: string; create?: boolean; href: string; icon: ReactNode; hint?: string }

/**
 * The source's "Jump to a page" palette. It lists the three workspace pages, every registry page and a "New ..." entry per
 * page, all from `GET /meta`. A native <dialog> is kept on purpose: it is a combobox/listbox overlay without header or footer
 * chrome, and the top layer gives it focus containment and Escape. Ctrl/Cmd+K is bound by the shell only while the host's
 * keyboard-shortcut preference is on; the toolbar button always opens it.
 */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { meta } = useApp();
  const router = useRouter();
  const { t } = useLocalization();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) { if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", ""); setQ(""); setIdx(0); setTimeout(() => inputRef.current?.focus(), 10); }
    if (!open && d.open) { if (typeof d.close === "function") d.close(); else d.removeAttribute("open"); }
  }, [open]);

  const entries = useMemo<Entry[]>(() => {
    const cat = new Map(meta.categories.map((c) => [c.key, c.label]));
    const workspace = t("Workspace");
    return [
      { key: "home", label: t("Overview"), group: workspace, href: tenantAdminPaths.overview(), icon: <LayoutDashboard className="h-4 w-4" />, hint: t("Activation readiness") },
      { key: "approvals", label: t("Approvals"), group: workspace, href: tenantAdminPaths.approvals(), icon: <Inbox className="h-4 w-4" />, hint: t("Changes waiting for a decision") },
      { key: "activity", label: t("Activity"), group: workspace, href: tenantAdminPaths.activity(), icon: <History className="h-4 w-4" />, hint: t("Audit trail") },
      ...meta.resources.map((r) => ({ key: r.key, label: r.label, group: cat.get(r.category) ?? "", href: tenantAdminPaths.resource(r.key), icon: <Icon name={r.icon} className="h-4 w-4" />, hint: r.summary })),
      ...meta.resources.map((r) => ({ key: `new-${r.key}`, label: t("New {value0}", { value0: r.singular }), group: t("Create"), create: true, href: tenantAdminPaths.resource(r.key, { new: true }), icon: <Icon name={r.icon} className="h-4 w-4" />, hint: r.label })),
    ];
  }, [meta, t]);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return entries.filter((e) => !e.create);
    const terms = s.split(/\s+/);
    return entries
      .map((e) => {
        const hay = `${e.label} ${e.group} ${e.hint ?? ""}`.toLowerCase();
        if (!terms.every((x) => hay.includes(x))) return null;
        const score = (e.label.toLowerCase().startsWith(s) ? 0 : e.label.toLowerCase().includes(s) ? 1 : 2) + (e.create ? 0.5 : 0);
        return { e, score };
      })
      .filter(Boolean)
      .sort((a, b) => a!.score - b!.score)
      .map((x) => x!.e);
  }, [entries, q]);

  useEffect(() => { setIdx(0); }, [q]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${idx}"]`)?.scrollIntoView?.({ block: "nearest" });
  }, [idx]);

  const go = (e?: Entry) => { if (!e) return; onClose(); router.push(e.href); };

  let lastGroup = "";
  return (
    <dialog ref={dialog} aria-label={t("Jump to a page")} onCancel={(e) => { e.preventDefault(); onClose(); }} onClick={(e) => { if (e.target === dialog.current) onClose(); }}
      className="m-0 mx-auto mt-[12vh] w-[calc(100%-2rem)] max-w-[620px] bg-transparent p-0 backdrop:bg-[rgba(9,31,29,0.4)]">
      {open && (
        <div className="animate-fade-in overflow-hidden rounded-2xl border border-line bg-white text-spruce-950 shadow-pop">
          <div className="flex items-center gap-3 border-b border-line px-4">
            <Search className="h-4 w-4 text-muted" />
            <SourceInput
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, results.length - 1)); }
                if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
                if (e.key === "Enter") go(results[idx]);
              }}
              placeholder="Search pages, or type “new” to create something"
              className="h-12 flex-1 bg-transparent text-[14px] outline-none placeholder:text-[#93A3A0]"
              aria-label="Search"
            />
            <span className="kbd"><LocalizedText message="Esc" /></span>
          </div>
          <ul ref={listRef} className="max-h-[52vh] overflow-y-auto p-2" role="listbox" aria-label={t("Pages")}>
            {results.length === 0 && <li className="px-3 py-8 text-center text-muted"><LocalizedText message="No page matches “{value0}”." values={{ value0: q }} /></li>}
            {results.map((e, i) => {
              const header = e.group !== lastGroup ? e.group : null;
              lastGroup = e.group;
              return (
                <li key={e.key} role="presentation">
                  {header && <p className="px-3 pb-1 pt-3 text-[11.5px] font-semibold text-muted first:pt-1">{header}</p>}
                  <SourceButton
                    data-idx={i}
                    role="option"
                    aria-selected={i === idx}
                    onMouseMove={() => setIdx(i)}
                    onClick={() => go(e)}
                    className={cx("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left", i === idx ? "bg-spruce-50" : "")}
                  >
                    <span className={cx("flex h-7 w-7 shrink-0 items-center justify-center rounded-md", i === idx ? "bg-spruce-900 text-white" : "bg-mist text-spruce-700")}>{e.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold">{e.label}</span>
                      {e.hint && <span className="block truncate text-[11.5px] text-muted">{e.hint}</span>}
                    </span>
                    {i === idx && <CornerDownLeft className="h-4 w-4 text-muted" />}
                  </SourceButton>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </dialog>
  );
}
