"use client";
import { Boxes, CornerDownLeft, FileCheck2, Pill, Plus, Radio, Receipt, Search, ShieldCheck, ShoppingBag, Truck, UserRound, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { cx } from "../../lib/cx";
import { useApiClient, useRefreshAll } from "../../lib/api";
import { useRouter } from "../../lib/navigation";
import { pharmacyPaths } from "../../routes";
import { SourceButton, SourceInput } from "../ui/controls";
import { useToast } from "../ui/toast";
import { NAV } from "./nav";

interface Hit { type: string; id: string; title: string; subtitle: string }
interface Cmd { id: string; label: string; sub?: string; icon: LucideIcon; group: string; run: () => void | Promise<void> }

const TYPE_ICON: Record<string, LucideIcon> = { patient: UserRound, prescription: Pill, product: Boxes, claim: FileCheck2, purchase_order: Truck, invoice: Receipt, order: ShoppingBag, authorization: ShieldCheck };
const TYPE_HREF: Record<string, (id: string) => string> = {
  patient: (id) => pharmacyPaths.patients({ id }), prescription: (id) => pharmacyPaths.workbench({ rx: id }), product: (id) => pharmacyPaths.inventory({ product: id }),
  claim: (id) => pharmacyPaths.claims({ claim: id }), purchase_order: (id) => pharmacyPaths.purchasing({ po: id }), invoice: (id) => pharmacyPaths.sales({ id }), order: (id) => pharmacyPaths.orders({ id }), authorization: (id) => pharmacyPaths.authorizations({ id }),
};
const TYPE_LABEL: Record<string, string> = { patient: "Patients", prescription: "Prescriptions", product: "Products", claim: "Claims", purchase_order: "Purchase orders", invoice: "Invoices", order: "Customer orders", authorization: "Authorizations" };

/**
 * The source's command palette. A native <dialog> is kept on purpose: it is a combobox/listbox overlay with no header or
 * footer chrome (a specialised layout), and the top layer gives it focus containment and Escape for free. It renders inside
 * the module root, so the scoped styles and the host theme apply to it.
 */
export function CommandPalette({ open, onClose, onNewRx }: { open: boolean; onClose: () => void; onNewRx: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const api = useApiClient();
  const refreshAll = useRefreshAll();
  const { t } = useLocalization();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) { if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", ""); setQ(""); setHits([]); setActive(0); setTimeout(() => input.current?.focus(), 0); }
    if (!open && d.open) { if (typeof d.close === "function") d.close(); else d.removeAttribute("open"); }
  }, [open]);

  useEffect(() => {
    if (q.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => { api.get<Hit[]>(`/search?q=${encodeURIComponent(q.trim())}`, { signal: controller.signal }).then((h) => { if (!controller.signal.aborted) { setHits(h); setActive(0); } }).catch(() => { if (!controller.signal.aborted) setHits([]); }); }, 140);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [api, q]);

  const commands = useMemo<Cmd[]>(() => {
    const go = (href: string) => () => router.push(href);
    const source: Cmd[] = [
      { id: "new-rx", label: "New prescription", sub: "Enter a paper or phoned-in prescription", icon: Plus, group: "Actions", run: onNewRx },
      { id: "erx", label: "Receive a test eRx", sub: "Simulates an inbound electronic prescription", icon: Radio, group: "Actions", run: async () => {
        const rx = await api.post<{ id: string; rx_no: string }>("/prescriptions/simulate-erx");
        await refreshAll();
        toast({ tone: "ok", title: t("{value0} received", { value0: rx.rx_no }), body: t("Added to the intake queue.") });
        router.push(pharmacyPaths.workbench({ rx: rx.id }));
      } },
      { id: "new-order", label: "New customer order", sub: "Phone, web or WhatsApp order for pickup or delivery", icon: ShoppingBag, group: "Actions", run: go(pharmacyPaths.orders({ new: true })) },
      { id: "auth-pending", label: "Authorizations waiting on payers", icon: ShieldCheck, group: "Actions", run: go(pharmacyPaths.authorizations({ status: "requested" })) },
      { id: "returns", label: "Return a sale", sub: "Find the invoice, then choose Return items", icon: Receipt, group: "Actions", run: go(pharmacyPaths.sales()) },
      { id: "claims-drafts", label: "Review draft claims", sub: "Claims waiting for submission", icon: FileCheck2, group: "Actions", run: go(pharmacyPaths.claims({ status: "draft" })) },
      { id: "claims-rejected", label: "Fix rejected claims", icon: FileCheck2, group: "Actions", run: go(pharmacyPaths.claims({ status: "rejected" })) },
      { id: "expiry", label: "Expiry and quarantine", icon: Boxes, group: "Actions", run: go(pharmacyPaths.inventory({ tab: "expiry" })) },
      ...NAV.flatMap((g) => g.items.map((it) => ({ id: it.href, label: it.label, sub: it.hint, icon: it.icon, group: "Go to", run: go(it.href) }))),
    ];
    const base: Cmd[] = source.map((c) => ({ ...c, label: t(c.label), sub: c.sub ? t(c.sub) : undefined, group: t(c.group) }));
    const term = q.trim().toLowerCase();
    const filtered = term ? base.filter((c) => c.label.toLowerCase().includes(term) || c.sub?.toLowerCase().includes(term)) : base;
    const found: Cmd[] = (term.length < 2 ? [] : hits).map((h) => ({ id: `${h.type}:${h.id}`, label: h.title, sub: h.subtitle, icon: TYPE_ICON[h.type] ?? Search, group: t(TYPE_LABEL[h.type] ?? "Results"), run: go(TYPE_HREF[h.type]?.(h.id) ?? "/") }));
    return [...found, ...filtered];
  }, [q, hits, router, onNewRx, toast, api, refreshAll, t]);

  const run = async (c?: Cmd) => {
    if (!c) return;
    onClose();
    try { await c.run(); } catch (e) { toast({ tone: "error", title: (e as Error).message }); }
  };

  const groups = commands.reduce<Record<string, Cmd[]>>((acc, c) => { (acc[c.group] ??= []).push(c); return acc; }, {});
  let idx = -1;

  return (
    <dialog ref={dialog} onCancel={(e) => { e.preventDefault(); onClose(); }} onClick={(e) => { if (e.target === dialog.current) onClose(); }}
      className="m-0 mx-auto mt-[12vh] w-[calc(100%-2rem)] max-w-[620px] bg-transparent p-0 backdrop:bg-[rgba(10,14,30,0.42)]">
      {open && (
        <div className="anim-pop overflow-hidden rounded-xl border border-line bg-surface text-ink shadow-pop">
          <div className="flex items-center gap-2.5 border-b border-line px-4">
            <Search className="size-4 text-ink-3" />
            <SourceInput ref={input} value={q} onChange={(e) => { setQ(e.target.value); setActive(0); }} aria-label="Search or run a command"
              placeholder="Search patients, Rx numbers, products, claims, or type a command"
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, commands.length - 1)); }
                if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
                if (e.key === "Enter") { e.preventDefault(); void run(commands[active]); }
              }}
              className="h-12 flex-1 bg-transparent text-[14px] outline-none placeholder:text-ink-3" />
          </div>
          <div className="scroll-y max-h-[52vh] p-1.5" role="listbox">
            {commands.length === 0 && <p className="px-3 py-6 text-center text-[13px] text-ink-3"><LocalizedText message="Nothing matches “{value0}”. Try a name, MRN, RX- number or product." values={{ value0: q }} /></p>}
            {Object.entries(groups).map(([g, cmds]) => (
              <div key={g} className="mb-1">
                <p className="px-2.5 pb-1 pt-2 text-[11.5px] font-medium text-ink-3">{g}</p>
                {cmds.map((c) => {
                  idx++;
                  const i = idx;
                  const Icon = c.icon;
                  return (
                    <SourceButton key={c.id} role="option" aria-selected={i === active} onMouseMove={() => setActive(i)} onClick={() => void run(c)}
                      className={cx("flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left", i === active ? "bg-cobalt-wash" : "")}>
                      <Icon className={cx("size-4 shrink-0", i === active ? "text-cobalt" : "text-ink-3")} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium">{c.label}</span>
                        {c.sub && <span className="block truncate text-xs text-ink-3">{c.sub}</span>}
                      </span>
                      {i === active && <CornerDownLeft className="size-3.5 text-cobalt" />}
                    </SourceButton>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 border-t border-line bg-surface-2 px-4 py-2 text-[11.5px] text-ink-3">
            <span><LocalizedText message="↑↓ to move" /></span><span><LocalizedText message="Enter to open" /></span><span><LocalizedText message="Esc to close" /></span>
          </div>
        </div>
      )}
    </dialog>
  );
}
