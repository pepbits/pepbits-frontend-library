"use client";
import { ArrowLeft, Banknote, Landmark } from "lucide-react";
import { ReferenceLink as Link } from "@pepbits/reference-host";
import { LocalizedText } from "@pepbits/ops-ui";
import { useState } from "react";
import { SourceButton, Table, TableBody, TableHeader, TableRow } from "../ui/controls";
import { Button, EmptyState, ErrorNote, Field, Input, ListSkeleton, Panel, PanelHeader, Segmented, Select, Skeleton, Stat, StatusPill, Tag, Td, Th } from "../ui/primitives";
import { useUserName } from "../shell/ShellContext";
import { useApi, useApiClient } from "../../lib/api";
import { cx } from "../../lib/cx";
import { usePharmacyFormat } from "../../lib/format";
import { useRouter, useSearchParams } from "../../lib/navigation";
import { useAction } from "../../lib/useAction";

interface RA { id: string; ra_no: string; payer_name: string; payer_code: string; status: string; total_claimed: number; total_approved: number; received_at: string; lines: number; denied: number; paid: number | null }
interface RADetail extends Omit<RA, "lines"> {
  lines: { id: string; claim_id: string; claim_no: string; claim_status: string; patient_name: string | null; submission: number; claimed: number; approved: number; expected: number; paid: number; outcome: string; denial_code: string | null; denial_reason: string | null }[];
  payments: { id: string; payment_ref: string; method: string; amount: number; received_at: string }[];
  history: { id: number; to_status: string; note: string | null; actor: string; at: string }[];
}
interface Payment { id: string; payment_ref: string; source: string; payer_code: string | null; ra_no: string | null; remittance_id: string | null; method: string; amount: number; allocated: number; status: string; received_at: string }

type Tab = "advice" | "payments";

/** Payment methods as the server names them; anything else is shown as it comes. */
const METHOD: Record<string, { label: string }> = {
  eft: { label: "Bank transfer" }, cheque: { label: "Cheque" }, card: { label: "Card" }, cash: { label: "Cash" }, wallet: { label: "Wallet" },
};

export function RemittanceView() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = (params.get("tab") as Tab) ?? "advice";
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-line bg-surface px-3 py-2 md:px-5">
        <Segmented value={tab} onChange={(next) => router.replace(`/remittance?tab=${next}`, { scroll: false })} items={[{ value: "advice", label: "Remittance advice" }, { value: "payments", label: "Payments received" }]} />
      </div>
      <div className="min-h-0 flex-1">{tab === "advice" ? <Advice /> : <Payments />}</div>
    </div>
  );
}

function Advice() {
  const params = useSearchParams();
  const router = useRouter();
  const { money, moneyC, dateShort, int, plural } = usePharmacyFormat();
  const [status, setStatus] = useState<"received" | "posted" | "">("received");
  const [closed, setClosed] = useState(false);
  const { data, error, isLoading, mutate } = useApi<RA[]>(`/remittances${status ? `?status=${status}` : ""}`);
  const selected = closed ? null : params.get("ra") ?? data?.[0]?.id ?? null;
  const select = (id: string | null) => { setClosed(id === null); router.replace(id ? `/remittance?tab=advice&ra=${id}` : "/remittance?tab=advice", { scroll: false }); };
  const waiting = (data ?? []).filter((r) => r.status === "received").reduce((s, r) => s + r.total_approved, 0);

  return (
    <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)]">
      <aside className={cx("flex min-h-0 flex-col border-r border-line bg-surface", selected && "hidden lg:flex")}>
        <div className="flex shrink-0 items-center gap-2 border-b border-line p-2.5">
          <Segmented size="sm" value={status} onChange={setStatus} items={[{ value: "received", label: "To post" }, { value: "posted", label: "Posted" }, { value: "", label: "All" }]} />
          {status === "received" && <span className="num ml-auto text-xs text-ink-3">{moneyC(waiting)}</span>}
        </div>
        {error ? <ErrorNote error={error} onRetry={() => mutate()} /> : isLoading && !data ? <ListSkeleton /> : !data?.length ? (
          <EmptyState icon={<Landmark className="size-5" />} title={status === "received" ? "Everything is posted" : "No remittance advice"} body="Payer responses to submitted claims arrive here." />
        ) : (
          <ul className="scroll-y min-h-0 flex-1" role="listbox">
            {data.map((r) => (
              <li key={r.id} role="option" aria-selected={r.id === selected}>
                <SourceButton onClick={() => select(r.id)} className={cx("flex w-full flex-col gap-0.5 border-b border-line px-4 py-2.5 text-left", r.id === selected ? "bg-cobalt-wash" : "hover:bg-surface-2")}>
                  <span className="flex items-center gap-2">
                    <span className="num text-[13px] font-semibold">{r.ra_no}</span><span className="text-[12px] font-medium text-ink-2">{r.payer_code}</span><StatusPill status={r.status} />
                    <span className="num ml-auto text-[13px] font-medium">{money(r.total_approved)}</span>
                  </span>
                  <span className="flex items-center gap-2 text-xs text-ink-3">
                    <span className="num"><LocalizedText message="{value0}, {value1}" values={{ value0: dateShort(r.received_at), value1: plural(r.lines, "claim") }} /></span>
                    {r.denied > 0 && <span className="text-danger"><LocalizedText message="{value0} denied" values={{ value0: int(r.denied) }} /></span>}
                    {r.paid != null && r.paid < r.total_approved - 0.01 && <span className="ml-auto text-amber"><LocalizedText message="short {value0}" values={{ value0: money(r.total_approved - r.paid) }} /></span>}
                  </span>
                </SourceButton>
              </li>
            ))}
          </ul>
        )}
      </aside>
      <section className={cx("min-h-0 min-w-0", !selected && "hidden lg:block")}>
        {selected ? <RAPane id={selected} onBack={() => select(null)} /> : <EmptyState title="Select a remittance advice" className="h-full" />}
      </section>
    </div>
  );
}

function RAPane({ id, onBack }: { id: string; onBack: () => void }) {
  const api = useApiClient();
  const { data: ra, error, mutate } = useApi<RADetail>(`/remittances/${id}`);
  const who = useUserName();
  const { t, money, moneyC, int, dateTime, plural } = usePharmacyFormat();
  const { run, busy } = useAction();
  const [amount, setAmount] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [method, setMethod] = useState("eft");
  if (error) return <ErrorNote error={error} onRetry={() => mutate()} />;
  if (!ra || ra.id !== id) return <div className="flex flex-col gap-4 p-5"><Skeleton className="h-16" /><Skeleton className="h-64" /></div>;

  const amt = amount === null ? ra.total_approved : Number(amount);
  const short = ra.total_approved - amt;
  const valid = amt > 0 && amt <= ra.total_approved + 0.001;
  const post = () => run("post", async ({ operationKey }) => {
    const p = await api.post<{ payment_ref: string }>(`/remittances/${id}/post-payment`, { amount: amt, method, reference: reference.trim() || undefined }, { operationKey });
    await mutate();
    setAmount(null); setReference("");
    return p;
  }, (p) => t("{value0} posted against {value1}", { value0: p.payment_ref, value1: ra.ra_no }), short > 0.01 ? t("{value0} short payment stays visible on each claim.", { value0: moneyC(short) }) : undefined);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="scroll-y min-h-0 flex-1">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-4 p-3 md:p-5">
          <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
            <SourceButton onClick={onBack} className="mt-1 rounded-md p-1 text-ink-3 hover:bg-surface-3 lg:hidden" aria-label="Back"><ArrowLeft className="size-4" /></SourceButton>
            <div className="min-w-0 flex-1">
              <h2 className="flex items-center gap-2 text-[20px] font-semibold tracking-tight"><span className="num">{ra.ra_no}</span><StatusPill status={ra.status} /></h2>
              <p className="text-[13px] text-ink-2"><LocalizedText message="{value0}, received {value1}" values={{ value0: ra.payer_name, value1: dateTime(ra.received_at) }} /></p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 rounded-xl border border-line bg-surface p-4 sm:grid-cols-4">
            <Stat label="Claimed" value={money(ra.total_claimed)} />
            <Stat label="Approved" value={money(ra.total_approved)} tone={ra.total_approved < ra.total_claimed - 0.01 ? "warn" : undefined} />
            <Stat label="Denied lines" value={int(ra.denied)} tone={ra.denied ? "danger" : undefined} />
            <Stat label="Received" value={ra.payments.length ? money(ra.payments.reduce((s, p) => s + p.amount, 0)) : "—"} sub={ra.payments.map((p) => p.payment_ref).join(", ")} />
          </div>

          <Panel>
            <PanelHeader title="Claims on this advice" />
            <div className="scroll-x">
              <Table className="w-full min-w-[820px] border-separate border-spacing-0">
                <TableHeader><TableRow><Th><LocalizedText message="Claim" /></Th><Th><LocalizedText message="Patient" /></Th><Th><LocalizedText message="Outcome" /></Th><Th align="right"><LocalizedText message="Claimed" /></Th><Th align="right"><LocalizedText message="Contract" /></Th><Th align="right"><LocalizedText message="Approved" /></Th><Th align="right"><LocalizedText message="Paid" /></Th><Th><LocalizedText message="Reason" /></Th></TableRow></TableHeader>
                <TableBody>
                  {ra.lines.map((l) => (
                    <TableRow key={l.id}>
                      <Td><Link href={`/claims?status=&claim=${l.claim_id}`} className="num font-medium text-cobalt hover:underline">{l.claim_no}</Link>{l.submission > 1 && <span className="ml-1 text-xs text-ink-3"><LocalizedText message="resubmission" /></span>}</Td>
                      <Td className="max-w-44 truncate">{l.patient_name}</Td>
                      <Td><StatusPill status={l.outcome} /></Td>
                      <Td align="right">{money(l.claimed)}</Td>
                      <Td align="right" className="text-ink-2">{money(l.expected)}</Td>
                      <Td align="right" className={l.approved < l.claimed - 0.01 ? "text-amber" : ""}>{money(l.approved)}</Td>
                      <Td align="right">{l.paid ? money(l.paid) : <span className="text-ink-3">—</span>}</Td>
                      <Td className="max-w-60 truncate text-xs text-danger">{l.denial_code ? `${l.denial_code}: ${l.denial_reason}` : ""}</Td>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="History" />
            <ol className="flex flex-col gap-1.5 px-4 py-3">
              {ra.history.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center gap-2 text-[12.5px]">
                  <StatusPill status={h.to_status} /><span className="text-ink-2">{who(h.actor)}</span>{h.note && <span className="text-ink-3">{h.note}</span>}
                  <span className="num ml-auto text-ink-3">{dateTime(h.at)}</span>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>

      {ra.status === "received" && ra.total_approved > 0 && (
        <div className="shrink-0 border-t border-line bg-surface px-3 py-3 md:px-5">
          <div className="mx-auto flex max-w-[1200px] flex-wrap items-end gap-3">
            <Field label="Amount received"><Input type="number" step="0.01" min={0} max={ra.total_approved} value={amount ?? ra.total_approved.toFixed(2)} onChange={(e) => setAmount(e.target.value)} className="num w-36 text-right" /></Field>
            <Field label="Method"><Select value={method} onChange={(e) => setMethod(e.target.value)} className="w-32"><option value="eft"><LocalizedText message="Bank transfer" /></option><option value="cheque"><LocalizedText message="Cheque" /></option></Select></Field>
            <Field label="Bank reference"><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Generated if blank" className="w-48" /></Field>
            <p className="mb-1.5 min-w-0 flex-1 text-[12.5px]">
              {!valid ? <span className="text-danger"><LocalizedText message="Enter an amount up to {value0}." values={{ value0: money(ra.total_approved) }} /></span>
                : short > 0.01 ? <Tag tone="warn"><LocalizedText message="Short by {value0}. Allocated pro rata; each claim stays part paid." values={{ value0: moneyC(short) }} /></Tag>
                : <span className="text-ink-3"><LocalizedText message="Allocates the full approved amount to {value0}." values={{ value0: plural(ra.lines.filter((l) => l.approved > 0).length, "claim") }} /></span>}
            </p>
            <Button variant="primary" icon={<Banknote className="size-4" />} disabled={!valid} loading={busy === "post"} onClick={post}><LocalizedText message="Post payment" /></Button>
          </div>
        </div>
      )}
      {ra.status === "received" && ra.total_approved === 0 && (
        <div className="shrink-0 border-t border-line bg-surface px-5 py-3 text-[12.5px] text-ink-2"><LocalizedText message="Every claim on this advice was denied." /> <Link href="/claims?status=rejected" className="text-cobalt underline underline-offset-2"><LocalizedText message="Work the rejections in Claims." /></Link></div>
      )}
    </div>
  );
}

function Payments() {
  const [source, setSource] = useState<"" | "payer" | "patient">("");
  const { data, error, isLoading, mutate } = useApi<Payment[]>(`/payments${source ? `?source=${source}` : ""}`);
  const { money, moneyC, dateTime, int } = usePharmacyFormat();
  const total = (data ?? []).reduce((s, p) => s + p.amount, 0);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-3 px-3 py-2.5 md:px-5">
        <Segmented size="sm" value={source} onChange={setSource} items={[{ value: "", label: "All" }, { value: "payer", label: "From payers" }, { value: "patient", label: "From patients" }]} />
        <span className="num ml-auto text-[13px] text-ink-2"><LocalizedText message="Latest {value0}, {value1}" values={{ value0: int(data?.length ?? 0), value1: moneyC(total) }} /></span>
      </div>
      {error ? <ErrorNote error={error} onRetry={() => mutate()} /> : isLoading && !data ? <ListSkeleton /> : (
        <div className="scroll-y min-h-0 flex-1 border-t border-line bg-surface">
          <Table className="w-full min-w-[760px] border-separate border-spacing-0">
            <TableHeader><TableRow><Th><LocalizedText message="Received" /></Th><Th><LocalizedText message="Reference" /></Th><Th><LocalizedText message="From" /></Th><Th><LocalizedText message="Method" /></Th><Th><LocalizedText message="Against" /></Th><Th align="right"><LocalizedText message="Amount" /></Th><Th><LocalizedText message="Status" /></Th></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((p) => (
                <TableRow key={p.id} className="hover:bg-surface-2">
                  <Td className="num text-ink-2">{dateTime(p.received_at)}</Td>
                  <Td className="num font-medium">{p.payment_ref}</Td>
                  <Td>{p.source === "payer" ? <span className="font-medium">{p.payer_code}</span> : <span className="text-ink-2"><LocalizedText message="Patient" /></span>}</Td>
                  <Td className="capitalize text-ink-2">{METHOD[p.method] ? <LocalizedText message={METHOD[p.method].label} /> : p.method}</Td>
                  <Td>{p.ra_no ? <Link href={`/remittance?tab=advice&ra=${p.remittance_id}`} className="num text-cobalt hover:underline">{p.ra_no}</Link> : <span className="text-ink-3"><LocalizedText message="Bill" /></span>}</Td>
                  <Td align="right" className={p.amount < 0 ? "text-danger" : ""}>{money(p.amount)}</Td>
                  <Td><StatusPill status={p.status} label={p.amount < 0 ? "Refund" : undefined} /></Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
