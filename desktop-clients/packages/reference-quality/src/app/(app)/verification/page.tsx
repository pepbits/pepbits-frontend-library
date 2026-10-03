"use client";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../components/controls";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "../../../lib/navigation";
import { AlertTriangle, Check, Send, ShieldCheck, X } from "lucide-react";
import { useQualityApi } from "../../../lib/api";
import { useApi } from "../../../lib/hooks";
import { useAuth, useMeta } from "../../../lib/auth";
import { Badge, Button, Checkbox, EmptyState, ErrorState, Loading, Modal, PageHeader, Panel, PromptModal, ResultStatus, Select, Tabs } from "../../../components/ui";
import { TargetBand } from "../../../components/kpi";
import { ResultDrawer } from "../../../components/ResultDrawer";
import { useToast } from "../../../components/toast";
import { cls } from "../../../lib/format";
import { useQualityFormat } from "../../../lib/format";
import type { KpiStatus, Unit } from "../../../lib/types";

interface Row {
  id: number;
  code: string;
  name: string;
  facility_code: string;
  facility_name: string;
  domain: string;
  period: string;
  numerator: number | null;
  denominator: number | null;
  value: number | null;
  unit: Unit;
  direction: "higher" | "lower";
  target: number;
  warning: number;
  status: string;
  blocking: number;
  warnings: number;
  last_actor: string | null;
  kpi_status: KpiStatus;
}

type Queue = "submit" | "verify" | "approve" | "approved";
const QUEUES: Record<Queue, { statuses: string; label: string; action?: { id: string; label: string; selectedLabel: string; done: string; permission: string; icon: typeof Send } }> = {
  submit: { statuses: "draft,rejected", label: "To submit", action: { id: "submit", label: "Submit", selectedLabel: "Submit selected", done: "submitted", permission: "results.submit", icon: Send } },
  verify: { statuses: "submitted", label: "To verify", action: { id: "verify", label: "Verify", selectedLabel: "Verify selected", done: "verified", permission: "results.verify", icon: ShieldCheck } },
  approve: { statuses: "verified", label: "To approve", action: { id: "approve", label: "Approve", selectedLabel: "Approve selected", done: "approved", permission: "results.approve", icon: Check } },
  approved: { statuses: "approved", label: "Approved" },
};

const PIPELINE = [
  { s: "draft", label: "Draft", color: "var(--color-line-strong)" },
  { s: "rejected", label: "Rejected", color: "var(--color-bad)" },
  { s: "submitted", label: "Submitted", color: "var(--color-info)" },
  { s: "verified", label: "Verified", color: "var(--color-primary)" },
  { s: "approved", label: "Approved", color: "var(--color-ok)" },
];

function VerificationInner() {
  const { t } = useLocalization();
  const { api } = useQualityApi();
  const { fmtNumber, fmtPeriod, fmtValue } = useQualityFormat();
  const meta = useMeta();
  const { user, can } = useAuth();
  const toast = useToast();
  const params = useSearchParams();
  const requested = params.get("queue") as Queue | null;
  const defaultQueue: Queue = requested && requested in QUEUES ? requested : user?.role === "verifier" ? "verify" : user?.role === "approver" ? "approve" : "submit";
  const [queue, setQueue] = useState<Queue>(defaultQueue);
  const [period, setPeriod] = useState(meta.latestPeriod ?? "");
  const [facility, setFacility] = useState("");
  const [domain, setDomain] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [failures, setFailures] = useState<{ id: number; message: string }[] | null>(null);

  const summary = useApi<{ counts: { status: string; n: number }[] }>("/verification/summary", { period });
  const { data, error, loading, reload } = useApi<Row[]>("/results", { period, status: QUEUES[queue].statuses, facility, domain });
  useEffect(() => setSelected(new Set()), [queue, period, facility, domain]);

  const counts: Record<string, number> = Object.fromEntries((summary.data?.counts ?? []).map((c) => [c.status, c.n]));
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const rows = data ?? [];
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const action = QUEUES[queue].action;

  const bulk = async (act: string, done: string, comment?: string) => {
    setBusy(true);
    try {
      const res = await api<{ succeeded: number; failed: { id: number; message: string }[] }>("/results/bulk", { body: { ids: [...selected], action: act, comment } });
      if (res.succeeded) toast(res.succeeded > 1 ? "{value0} results {value1}." : "{value0} result {value1}.", "success", { value0: res.succeeded, value1: t(done) });
      if (res.failed.length) setFailures(res.failed);
      setSelected(new Set());
      setRejecting(false);
      await Promise.all([reload(), summary.reload()]);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Bulk action failed.", "error");
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: number, v: boolean) =>
    setSelected((s) => {
      const n = new Set(s);
      if (v) n.add(id);
      else n.delete(id);
      return n;
    });

  return (
    <>
      <PageHeader
        title="Verification"
        description="Results move from draft to submitted, verified and approved. The person who submits a result cannot verify it, and the verifier cannot approve it. Open blocking validation issues stop a result from moving forward."
        actions={
          <Select aria-label="Period" className="w-36" value={period} onChange={(e) => setPeriod(e.target.value)}>
            {[...meta.periods].reverse().map((p) => (
              <option key={p} value={p}>
                {fmtPeriod(p)}
              </option>
            ))}
          </Select>
        }
      />

      <section className="mb-6 rounded-lg border border-line bg-panel p-4">
        <div className="mb-3 flex items-baseline justify-between text-sm">
          <span className="text-ink-2">
            <span className="num font-semibold text-ink">{counts.approved ?? 0}</span> <LocalizedText message="of {value0} results approved for {value1}" values={{ value0: total, value1: fmtPeriod(period) }} />
          </span>
          <span className="num text-xs text-ink-3"><LocalizedText message="{value0}% complete" values={{ value0: total ? Math.round(((counts.approved ?? 0) / total) * 100) : 0 }} /></span>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {PIPELINE.map((x) => (
            <div key={x.s}>
              <div className="h-1.5 rounded-full" style={{ background: x.color, opacity: counts[x.s] ? 1 : 0.25 }} />
              <div className="mt-1.5 text-xs text-ink-3"><LocalizedText message={x.label} /></div>
              <div className="num text-lg font-semibold">{counts[x.s] ?? 0}</div>
            </div>
          ))}
        </div>
      </section>

      <Panel bodyClassName="p-0">
        <div className="flex flex-wrap items-end justify-between gap-3 px-4 pt-2">
          <Tabs
            value={queue}
            onChange={setQueue}
            items={(Object.keys(QUEUES) as Queue[]).map((q) => ({
              id: q,
              label: QUEUES[q].label,
              count: QUEUES[q].statuses.split(",").reduce((a, s) => a + (counts[s] ?? 0), 0),
            }))}
          />
          <div className="flex gap-2 pb-2">
            <Select aria-label="Facility" className="h-8 w-48 text-[13px]" value={facility} onChange={(e) => setFacility(e.target.value)}>
              <option value=""><LocalizedText message="All facilities" /></option>
              {meta.facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
            <Select aria-label="Domain" className="h-8 w-44 text-[13px]" value={domain} onChange={(e) => setDomain(e.target.value)}>
              <option value=""><LocalizedText message="All domains" /></option>
              {meta.domains.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </Select>
          </div>
        </div>

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-y border-primary/20 bg-primary-soft/60 px-4 py-2 text-sm">
            <span className="mr-2 font-medium"><LocalizedText message="{value0} selected" values={{ value0: selected.size }} /></span>
            {action && can(action.permission) && (
              <Button size="sm" variant="primary" loading={busy} icon={<action.icon className="size-3.5" />} onClick={() => bulk(action.id, action.done)}><LocalizedText message={action.selectedLabel} /></Button>
            )}
            {(queue === "verify" || queue === "approve") && can("results.verify") && (
              <Button size="sm" variant="danger" icon={<X className="size-3.5" />} onClick={() => setRejecting(true)}><LocalizedText message="Reject selected" /></Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}><LocalizedText message="Clear selection" /></Button>
          </div>
        )}

        {error && (
          <div className="p-4">
            <ErrorState message={error} onRetry={reload} />
          </div>
        )}
        {!data && loading && <Loading className="p-4" rows={8} />}
        {data && rows.length === 0 && (
          <EmptyState title={queue === "approved" ? t("No approved results yet") : t("The “{value0}” queue is clear", { value0: t(QUEUES[queue].label).toLowerCase() })}>
            {queue === "approved" ? <LocalizedText message="Approved results for this period will appear here." /> : <LocalizedText message="There is nothing waiting for the selected filters." />}
          </EmptyState>
        )}
        {data && rows.length > 0 && (
          <div className={cls("max-h-[640px] overflow-auto", loading && "opacity-60")}>
            <Table className="data-table">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">{action && <Checkbox checked={allChecked} indeterminate={selected.size > 0 && !allChecked} onChange={(v) => setSelected(v ? new Set(rows.map((r) => r.id)) : new Set())} />}</TableHead>
                  <TableHead><LocalizedText message="Indicator" /></TableHead>
                  <TableHead><LocalizedText message="Facility" /></TableHead>
                  <TableHead className="right"><LocalizedText message="Numerator / denominator" /></TableHead>
                  <TableHead className="right"><LocalizedText message="Value" /></TableHead>
                  <TableHead className="min-w-[150px]"><LocalizedText message="Against target" /></TableHead>
                  <TableHead><LocalizedText message="Checks" /></TableHead>
                  <TableHead><LocalizedText message="Status" /></TableHead>
                  <TableHead><LocalizedText message="Last action by" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} className={cls("cursor-pointer", selected.has(r.id) && "bg-primary-soft/40")} onClick={() => setOpen(r.id)}>
                    <TableCell onClick={(e) => e.stopPropagation()}>{action && <Checkbox checked={selected.has(r.id)} onChange={(v) => toggle(r.id, v)} />}</TableCell>
                    <TableCell className="max-w-[300px]">
                      <span className="text-xs text-ink-3">{r.code}</span>
                      <span className="block truncate font-medium">{r.name}</span>
                    </TableCell>
                    <TableCell title={r.facility_name}>{r.facility_code}</TableCell>
                    <TableCell className="num right text-ink-2">
                      {fmtNumber(r.numerator, r.unit === "minutes" ? 1 : 0)} / {fmtNumber(r.denominator)}
                    </TableCell>
                    <TableCell className="num right font-medium">{fmtValue(r.value, r.unit)}</TableCell>
                    <TableCell>
                      <TargetBand compact value={r.value} target={r.target} warning={r.warning} direction={r.direction} unit={r.unit} />
                    </TableCell>
                    <TableCell>
                      {r.blocking > 0 ? (
                        <Badge tone="bad">
                          <AlertTriangle className="size-3" /> <LocalizedText message="{value0} blocking" values={{ value0: r.blocking }} />
                        </Badge>
                      ) : r.warnings > 0 ? (
                        <Badge tone="warn">
                          <LocalizedText message={r.warnings > 1 ? "{value0} warnings" : "{value0} warning"} values={{ value0: r.warnings }} />
                        </Badge>
                      ) : (
                        <span className="text-xs text-ok"><LocalizedText message="Passed" /></span>
                      )}
                    </TableCell>
                    <TableCell>
                      <ResultStatus status={r.status} />
                    </TableCell>
                    <TableCell className="text-ink-2">{r.last_actor ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>

      <ResultDrawer
        resultId={open}
        onClose={() => setOpen(null)}
        onChanged={() => {
          void reload();
          void summary.reload();
        }}
      />
      <PromptModal
        open={rejecting}
        onClose={() => setRejecting(false)}
        title={selected.size === 1 ? t("Reject one result") : t("Reject {value0} results", { value0: selected.size })}
        description="Each result returns to its data owner with your comment."
        label="What needs to change"
        required
        danger
        confirmLabel="Reject"
        onConfirm={(t) => bulk("reject", "rejected", t)}
      />
      <Modal open={!!failures} onClose={() => setFailures(null)} title={t("{value0} results were not updated", { value0: failures?.length ?? 0 })} footer={<Button onClick={() => setFailures(null)}><LocalizedText message="Close" /></Button>}>
        <ul className="max-h-80 space-y-2 overflow-auto text-sm">
          {failures?.map((f) => (
            <li key={f.id} className="rounded border border-line p-2 text-ink-2">
              {f.message}
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}

export default function VerificationPage() {
  return (
    <Suspense>
      <VerificationInner />
    </Suspense>
  );
}
