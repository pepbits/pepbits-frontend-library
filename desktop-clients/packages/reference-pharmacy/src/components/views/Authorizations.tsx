"use client";
import clsx from "clsx";
import { ArrowLeft, Search, ShieldCheck, Sparkles } from "lucide-react";
import { ReferenceLink as Link } from "@pepbits/reference-host";
import { LocalizedText } from "@pepbits/ops-ui";
import { useEffect, useState } from "react";
import { SourceButton, Table, TableBody, TableHeader, TableRow } from "../ui/controls";
import { Button, DateInput, EmptyState, ErrorNote, Field, Input, ListSkeleton, Panel, PanelHeader, Segmented, Skeleton, StatusPill, Tag, Td, Th, Textarea } from "../ui/primitives";
import { useUserName } from "../shell/ShellContext";
import { useApi, useApiClient } from "../../lib/api";
import { usePharmacyFormat } from "../../lib/format";
import { useRouter, useSearchParams } from "../../lib/navigation";
import { useAction } from "../../lib/useAction";

interface Auth {
  id: string; auth_no: string; status: string; requested_at: string; decided_at: string | null; valid_to: string | null; note: string | null; justification: string | null;
  payer_ref: string | null; decided_by: string | null; payer_name: string; payer_code: string; rx_no: string; prescription_id: string; priority: string;
  diagnosis_code: string | null; diagnosis: string | null; patient_id: string; patient_name: string; mrn: string; doctor_name: string; member_id: string | null; plan_name: string | null;
  hours_open: number; item_names: string;
}
interface AuthDetail extends Auth {
  items: { id: string; name: string; generic: string; strength: string; sig: string; days: number; qty_requested: number; qty_approved: number; price_per_unit: number }[];
  history: { id: number; to_status: string; note: string | null; actor: string; at: string }[];
}
type Tab = "requested" | "approved" | "partially_approved" | "denied" | "";

const PRIORITY: Record<string, { label: string }> = { routine: { label: "Routine" }, urgent: { label: "Urgent" }, stat: { label: "Stat" } };

const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function AuthorizationsView() {
  const params = useSearchParams();
  const router = useRouter();
  const { dateShort, plural, int, t } = usePharmacyFormat();
  const [tab, setTab] = useState<Tab>((params.get("status") as Tab) ?? "requested");
  // A link that targets a tab (the palette's "Authorizations waiting on payers") selects it even while this page is open.
  const urlStatus = params.get("status");
  useEffect(() => { if (urlStatus !== null) setTab(urlStatus as Tab); }, [urlStatus]);
  const [q, setQ] = useState("");
  const selected = params.get("id");
  const select = (id: string | null, status?: Tab) => {
    const sp = new URLSearchParams(params.toString());
    if (id) sp.set("id", id); else sp.delete("id");
    if (status !== undefined) sp.set("status", status);
    router.replace(`/authorizations?${sp.toString()}`, { scroll: false });
  };
  const list = useApi<{ rows: Auth[]; counts: Record<string, number> }>(`/authorizations?status=${tab}${q ? `&q=${encodeURIComponent(q)}` : ""}`, { refreshInterval: 20_000 });
  const rows = list.data?.rows ?? [];
  const c = list.data?.counts ?? {};
  const current = selected ?? rows[0]?.id ?? null;
  const waited = (h: number) => (h < 1 ? t("under 1 h") : h < 48 ? t("{value0} h", { value0: int(h) }) : plural(Math.round(h / 24), "day"));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line bg-surface px-4 py-2.5 md:px-5">
        <div className="scroll-x max-w-full">
          <Segmented<Tab> value={tab} onChange={(next) => { setTab(next); select(null, next); }} items={[
            { value: "requested", label: "Waiting on payer", count: c.requested ?? 0, tone: c.requested ? "warn" : undefined },
            { value: "approved", label: "Approved", count: c.approved ?? 0 }, { value: "partially_approved", label: "Part approved", count: c.partially_approved ?? 0 },
            { value: "denied", label: "Denied", count: c.denied ?? 0 }, { value: "", label: "All" },
          ]} />
        </div>
        <p className="ml-auto hidden text-xs text-ink-3 xl:block"><LocalizedText message="New requests start from a prescription in the Rx workbench, so the medicine, quantity and diagnosis come with them." /></p>
      </div>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[380px_minmax(0,1fr)]">
        <aside className={clsx("flex min-h-0 flex-col border-r border-line bg-surface", selected && "hidden lg:flex")}>
          <div className="shrink-0 border-b border-line p-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Authorization, patient or RX number" className="pl-8" aria-label="Search authorizations" />
            </div>
          </div>
          <div className="scroll-y min-h-0 flex-1">
            {list.error && <ErrorNote error={list.error} onRetry={() => list.mutate()} />}
            {!list.data && !list.error && <ListSkeleton />}
            {list.data && !rows.length && <EmptyState icon={<ShieldCheck className="size-5" />} title={tab === "requested" ? "Nothing waiting on payers" : "No authorizations here"} body="Request one from a prescription that has a medicine needing payer approval." />}
            <ul className="divide-y divide-line">
              {rows.map((a) => (
                <li key={a.id}>
                  <SourceButton onClick={() => select(a.id)} className={clsx("flex w-full flex-col gap-1 px-4 py-2.5 text-left", a.id === current ? "bg-cobalt-wash" : "hover:bg-surface-2")}>
                    <span className="flex items-center gap-2">
                      <span className="num text-[13.5px] font-semibold">{a.auth_no}</span>
                      <span className="truncate text-[13px] text-ink-2">{a.patient_name}</span>
                      <Tag tone="info" className="ml-auto">{a.payer_code}</Tag>
                    </span>
                    <span className="truncate text-xs text-ink-3">{a.item_names}, {a.rx_no}</span>
                    <span className="flex items-center gap-1.5">
                      <StatusPill status={a.status} />
                      {a.priority !== "routine" && <Tag tone="warn" className="capitalize">{PRIORITY[a.priority] ? t(PRIORITY[a.priority].label) : a.priority}</Tag>}
                      <span className={clsx("num ml-auto text-xs", a.status === "requested" && a.hours_open >= 24 ? "font-medium text-danger" : "text-ink-3")}>
                        {a.status === "requested" ? <LocalizedText message="Waiting {value0}" values={{ value0: waited(a.hours_open) }} /> : <LocalizedText message="Decided {value0}" values={{ value0: dateShort(a.decided_at) }} />}
                      </span>
                    </span>
                  </SourceButton>
                </li>
              ))}
            </ul>
          </div>
        </aside>
        <section className={clsx("min-h-0 min-w-0", !selected && "hidden lg:block")}>
          {current ? <AuthPane key={current} id={current} onBack={() => select(null)} /> : <EmptyState className="h-full" icon={<ShieldCheck className="size-5" />} title="Choose an authorization" />}
        </section>
      </div>
    </div>
  );
}

function AuthPane({ id, onBack }: { id: string; onBack: () => void }) {
  const { data: a, error, mutate } = useApi<AuthDetail>(`/authorizations/${id}`);
  const who = useUserName();
  const { money, dateShort, dateTime, t } = usePharmacyFormat();
  if (error) return <ErrorNote error={error} onRetry={() => mutate()} />;
  if (!a) return <div className="space-y-3 p-5"><Skeleton className="h-16" /><Skeleton className="h-48" /></div>;
  const value = a.items.reduce((s, i) => s + i.qty_requested * i.price_per_unit, 0);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SourceButton onClick={onBack} className="flex shrink-0 items-center gap-1.5 border-b border-line bg-surface px-4 py-2 text-[13px] text-cobalt lg:hidden"><ArrowLeft className="size-4" /><LocalizedText message="Back to list" /></SourceButton>
      <div className="scroll-y min-h-0 flex-1 space-y-4 p-4 md:p-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2"><h2 className="num text-[20px] font-semibold tracking-tight">{a.auth_no}</h2><StatusPill status={a.status} /></div>
            <p className="text-[13px] text-ink-2">
              <Link href={`/patients?id=${a.patient_id}`} className="font-medium text-cobalt hover:underline">{a.patient_name}</Link>, {a.mrn}. {a.payer_name}{a.plan_name ? `, ${a.plan_name}` : ""}{a.member_id ? <>{", "}<LocalizedText message="member {value0}" values={{ value0: a.member_id }} /></> : null}.
            </p>
          </div>
          <Link href={`/workbench?rx=${a.prescription_id}`} className="inline-flex h-8 items-center rounded-md border border-line-strong bg-surface px-3 text-[13px] font-medium hover:bg-surface-2"><LocalizedText message="Open {value0}" values={{ value0: a.rx_no }} /></Link>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(260px,1fr)]">
          <Panel>
            <PanelHeader title="Requested" sub={t("Value at list price {value0}", { value0: money(value) })} />
            <Table className="w-full">
              <TableHeader><TableRow><Th><LocalizedText message="Medicine and directions" /></Th><Th align="right"><LocalizedText message="Requested" /></Th><Th align="right"><LocalizedText message="Approved" /></Th></TableRow></TableHeader>
              <TableBody>
                {a.items.map((i) => (
                  <TableRow key={i.id}>
                    <Td><p className="font-medium">{i.name}</p><p className="text-xs text-ink-3">{i.generic} {i.strength}, {i.sig}</p></Td>
                    <Td align="right">{i.qty_requested}</Td>
                    <Td align="right" className={a.status === "requested" ? "text-ink-3" : i.qty_approved < i.qty_requested ? "font-semibold text-amber" : "font-semibold text-ok"}>{a.status === "requested" ? "—" : i.qty_approved}</Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
          <Panel>
            <PanelHeader title="Clinical case" />
            <dl className="grid gap-2.5 px-4 py-3 text-[13px]">
              <div><dt className="text-xs text-ink-3"><LocalizedText message="Diagnosis" /></dt><dd>{a.diagnosis_code ? <span className="num">{a.diagnosis_code} </span> : null}{a.diagnosis ?? <LocalizedText message="Not recorded" />}</dd></div>
              <div><dt className="text-xs text-ink-3"><LocalizedText message="Prescriber" /></dt><dd>{a.doctor_name}</dd></div>
              <div><dt className="text-xs text-ink-3"><LocalizedText message="Justification sent" /></dt><dd>{a.justification ?? <span className="text-ink-3"><LocalizedText message="None recorded" /></span>}</dd></div>
              <div><dt className="text-xs text-ink-3"><LocalizedText message="Requested" /></dt><dd>{dateTime(a.requested_at)}</dd></div>
              {a.decided_at && <div><dt className="text-xs text-ink-3"><LocalizedText message="Decision" /></dt><dd>
                {dateTime(a.decided_at)}
                {a.decided_by ? <>{" "}<LocalizedText message="by {value0}" values={{ value0: who(a.decided_by) }} /></> : null}
                {a.payer_ref ? <>{", "}<LocalizedText message="payer ref {value0}" values={{ value0: a.payer_ref }} /></> : null}
                {a.valid_to ? <>{", "}<LocalizedText message="valid to {value0}" values={{ value0: dateShort(a.valid_to) }} /></> : null}
                {a.note ? `. ${a.note}` : ""}
              </dd></div>}
            </dl>
          </Panel>
        </div>

        {a.status === "requested" && <DecisionForm a={a} onDone={() => mutate()} />}

        <Panel>
          <PanelHeader title="History" />
          <ul className="divide-y divide-line text-[13px]">
            {a.history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-2 px-4 py-2">
                <StatusPill status={h.to_status} /><span className="text-ink-2">{who(h.actor)}</span>{h.note && <span className="text-ink-3">{h.note}</span>}
                <span className="num ml-auto text-ink-3">{dateTime(h.at)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function DecisionForm({ a, onDone }: { a: AuthDetail; onDone: () => void }) {
  const api = useApiClient();
  const { t } = usePharmacyFormat();
  const { run, busy } = useAction();
  const [decision, setDecision] = useState<"approved" | "partially_approved" | "denied">("approved");
  const [qty, setQty] = useState<Record<string, number>>(Object.fromEntries(a.items.map((i) => [i.id, Math.max(1, Math.floor(i.qty_requested / 2))])));
  const [ref, setRef] = useState("");
  const [validTo, setValidTo] = useState(() => isoOf(new Date(Date.now() + 90 * 86400000)));
  const [note, setNote] = useState("");
  const ok = decision === "denied" ? note.trim().length > 2 : !!validTo;

  const save = async () => {
    const done = decision === "denied" ? t("{value0} denied", { value0: a.auth_no }) : decision === "approved" ? t("{value0} approved", { value0: a.auth_no }) : t("{value0} part approved", { value0: a.auth_no });
    const r = await run("decision", ({ operationKey }) => api.post(`/authorizations/${a.id}/decision`, {
      decision, payer_ref: ref.trim() || undefined, valid_to: decision === "denied" ? undefined : validTo, note: note.trim() || undefined,
      items: a.items.map((i) => ({ id: i.id, qty_approved: decision === "approved" ? i.qty_requested : decision === "denied" ? 0 : qty[i.id] ?? 0 })),
    }, { operationKey }), done, t("Claims for this prescription will use the approved quantity."));
    if (r !== undefined) onDone();
  };
  const simulate = async () => {
    const r = await run("simulate", ({ operationKey }) => api.post(`/authorizations/${a.id}/decide`, {}, { operationKey }), t("Payer response received (demo)"));
    if (r !== undefined) onDone();
  };

  return (
    <Panel className="border-cobalt/40">
      <PanelHeader title="Record the payer's decision" sub="Enter what the payer returned through their portal, by phone or by letter." />
      <div className="grid gap-4 px-4 py-3">
        <Segmented value={decision} onChange={setDecision} items={[{ value: "approved", label: "Approved in full" }, { value: "partially_approved", label: "Approved in part" }, { value: "denied", label: "Denied" }]} />
        {decision === "partially_approved" && (
          <div className="grid gap-2">
            {a.items.map((i) => (
              <div key={i.id} className="flex items-center gap-3 text-[13px]">
                <span className="min-w-0 flex-1 truncate">{i.name}</span>
                <span className="text-xs text-ink-3"><LocalizedText message="of {value0}" values={{ value0: i.qty_requested }} /></span>
                <Input type="number" min={0} max={i.qty_requested} value={qty[i.id] ?? 0} aria-label={t("Approved quantity for {value0}", { value0: i.name })} className="num w-24 text-right"
                  onChange={(e) => setQty({ ...qty, [i.id]: Math.max(0, Math.min(Number(e.target.value), i.qty_requested)) })} />
              </div>
            ))}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <Field label="Payer reference (optional)"><Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder={t("e.g. {value0}-PA-778812", { value0: a.payer_code })} /></Field>
          {decision !== "denied" && <Field label="Valid until"><DateInput value={validTo} onChange={(e) => setValidTo(e.target.value)} /></Field>}
        </div>
        <Field label={decision === "denied" ? "Payer's reason for denial" : "Note (optional)"}>
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={decision === "denied" ? "e.g. Step therapy not documented" : "e.g. Review after 12 weeks"} />
        </Field>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" disabled={!ok} loading={busy === "decision"} onClick={save}><LocalizedText message="Save decision" /></Button>
          <Button variant="ghost" icon={<Sparkles className="size-4" />} loading={busy === "simulate"} onClick={simulate}><LocalizedText message="Simulate payer response" /></Button>
          <span className="text-xs text-ink-3"><LocalizedText message="The simulation is for demos; it picks an outcome at random." /></span>
        </div>
      </div>
    </Panel>
  );
}
