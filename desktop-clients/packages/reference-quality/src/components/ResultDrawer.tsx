"use client";
import { LocalizedText } from "@pepbits/ops-ui";
import { Table, TableBody, TableRow, TableCell } from "./controls";

import { useEffect, useState } from "react";
import { ReferenceLink as Link } from "@pepbits/reference-host";
import { AlertTriangle, Check, CornerUpLeft, Pencil, Send, ShieldCheck, X } from "lucide-react";
import { useQualityApi } from "../lib/api";
import { useApi } from "../lib/hooks";
import { useAuth } from "../lib/auth";
import { Badge, Button, Drawer, ErrorState, Field, Input, Loading, PromptModal, ResultStatus, Textarea } from "./ui";
import { KpiStatusBadge, TargetBand } from "./kpi";
import { useToast } from "./toast";

import { useQualityFormat } from "../lib/format";
import type { KpiStatus, Unit } from "../lib/types";

interface ResultDetail {
  result: {
    id: number;
    code: string;
    name: string;
    period: string;
    facility_name: string;
    facility_code: string;
    numerator: number | null;
    denominator: number | null;
    value: number | null;
    status: string;
    unit: Unit;
    direction: "higher" | "lower";
    target: number;
    warning: number;
    numerator_def: string;
    denominator_def: string;
    exclusions: string | null;
    source: string;
    version: number;
    indicator_id: number;
    kpi_status: KpiStatus;
    min_sample: number;
    comment: string | null;
  };
  reviews: { id: number; action: string; from_status: string | null; to_status: string | null; user_name: string | null; role: string | null; comment: string | null; created_at: string }[];
  issues: { id: number; rule_code: string; rule_name: string; severity: string; status: string; message: string }[];
  previous: { period: string; value: number | null; numerator: number | null; denominator: number | null }[];
}

const ACTIONS = [
  { id: "submit", label: "Submit for verification", from: ["draft", "rejected"], permission: "results.submit", icon: Send, variant: "primary" as const },
  { id: "verify", label: "Verify", from: ["submitted"], permission: "results.verify", icon: ShieldCheck, variant: "primary" as const },
  { id: "approve", label: "Approve", from: ["verified"], permission: "results.approve", icon: Check, variant: "primary" as const },
  { id: "reject", label: "Reject", from: ["submitted", "verified"], permission: "results.verify", icon: X, variant: "danger" as const, needsComment: true },
  { id: "return", label: "Return to draft", from: ["submitted", "verified", "approved"], permission: "results.approve", icon: CornerUpLeft, variant: "secondary" as const, needsComment: true },
];

export function ResultDrawer({ resultId, onClose, onChanged }: { resultId: number | null; onClose: () => void; onChanged?: () => void }) {
  const { api } = useQualityApi();
  const { fmtDateTime, fmtNumber, fmtPeriod, fmtValue, humanize } = useQualityFormat();
  const { can } = useAuth();
  const toast = useToast();
  const { data, error, loading, reload } = useApi<ResultDetail>(resultId ? `/results/${resultId}` : null);
  const [editing, setEditing] = useState(false);
  const [num, setNum] = useState("");
  const [den, setDen] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<(typeof ACTIONS)[number] | null>(null);

  useEffect(() => {
    setEditing(false);
  }, [resultId]);

  const r = data?.result;
  const blocking = data?.issues.filter((i) => i.status === "open" && i.severity === "blocking") ?? [];

  const act = async (action: string, comment?: string) => {
    setBusy(action);
    try {
      const res = await api<{ message: string }>(`/results/${resultId}/${action}`, { body: { comment } });
      toast(res.message);
      setPrompt(null);
      await reload();
      onChanged?.();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Action failed.", "error");
    } finally {
      setBusy(null);
    }
  };

  const saveEdit = async () => {
    setBusy("edit");
    try {
      await api(`/results/${resultId}`, { method: "PUT", body: { numerator: num, denominator: den, reason, version: r?.version } });
      toast("Result updated. Re-run validation to clear issues that no longer apply.");
      setEditing(false);
      await reload();
      onChanged?.();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save.", "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Drawer open={resultId !== null} onClose={onClose} title={r ? `${r.code} · ${r.facility_code}` : "Result"} subtitle={r ? `${r.name}, ${fmtPeriod(r.period)}` : undefined}>
      {error && <ErrorState message={error} onRetry={reload} />}
      {!data && loading && <Loading rows={6} />}
      {r && data && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <ResultStatus status={r.status} />
            <KpiStatusBadge status={r.kpi_status} />
            <Badge>{r.source === "events" ? <LocalizedText message="Calculated from Event Pulse" /> : <LocalizedText message="Submitted data" />}</Badge>
            <Badge><LocalizedText message="Version {value0}" values={{ value0: r.version }} /></Badge>
          </div>

          <div className="rounded-lg border border-line p-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-xs text-ink-3"><LocalizedText message="Result" /></div>
                <div className="num text-3xl font-semibold tracking-tight">{fmtValue(r.value, r.unit)}</div>
              </div>
              <div className="num text-right text-sm text-ink-2">
                {fmtNumber(r.numerator, r.unit === "minutes" ? 1 : 0)} / {fmtNumber(r.denominator)}
                <div className="text-xs text-ink-3"><LocalizedText message="numerator / denominator" /></div>
              </div>
            </div>
            <div className="mt-4">
              <TargetBand value={r.value} target={r.target} warning={r.warning} direction={r.direction} unit={r.unit} />
              <div className="mt-1 flex justify-between text-xs text-ink-3">
                <span><LocalizedText message="Watch {value0}" values={{ value0: fmtValue(r.warning, r.unit) }} /></span>
                <span><LocalizedText message="Target {value0} {value1}" values={{ value0: r.direction === "higher" ? "≥" : "≤", value1: fmtValue(r.target, r.unit) }} /></span>
              </div>
            </div>
          </div>

          {blocking.length > 0 && (
            <div className="rounded-md border border-bad/30 bg-bad-soft/60 p-3 text-sm">
              <div className="flex items-center gap-2 font-medium text-bad">
                <AlertTriangle className="size-4" /> <LocalizedText message={blocking.length > 1 ? "{value0} blocking issues prevent submission, verification and approval" : "{value0} blocking issue prevents submission, verification and approval"} values={{ value0: blocking.length }} />
              </div>
              <ul className="mt-2 space-y-1 text-ink-2">
                {blocking.map((i) => (
                  <li key={i.id}>
                    <span className="font-medium">{i.rule_code}</span> {i.message}
                  </li>
                ))}
              </ul>
              <Link href="/validation?status=open&severity=blocking" className="mt-2 inline-block text-primary hover:underline"><LocalizedText message="Open validation" /></Link>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {ACTIONS.filter((a) => a.from.includes(r.status) && can(a.permission)).map((a) => (
              <Button
                key={a.id}
                variant={a.variant}
                icon={<a.icon className="size-4" />}
                loading={busy === a.id}
                disabled={["submit", "verify", "approve"].includes(a.id) && blocking.length > 0}
                onClick={() => (a.needsComment ? setPrompt(a) : act(a.id))}
              >
                <LocalizedText message={a.label} />
              </Button>
            ))}
            {["draft", "rejected"].includes(r.status) && can("results.edit") && !editing && (
              <Button
                icon={<Pencil className="size-4" />}
                onClick={() => {
                  setNum(r.numerator === null ? "" : String(r.numerator));
                  setDen(r.denominator === null ? "" : String(r.denominator));
                  setReason("");
                  setEditing(true);
                }}
              ><LocalizedText message="Correct data" /></Button>
            )}
          </div>

          {editing && (
            <div className="space-y-3 rounded-lg border border-line bg-surface/60 p-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Numerator">
                  <Input type="number" step="any" value={num} onChange={(e) => setNum(e.target.value)} />
                </Field>
                <Field label="Denominator">
                  <Input type="number" step="any" value={den} onChange={(e) => setDen(e.target.value)} />
                </Field>
              </div>
              <Field label="Reason for change" hint="Recorded in the review trail and audit log">
                <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Reconciled with ADT census extract dated 3 October" />
              </Field>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setEditing(false)}><LocalizedText message="Cancel" /></Button>
                <Button variant="primary" loading={busy === "edit"} disabled={!reason.trim()} onClick={saveEdit}><LocalizedText message="Save correction" /></Button>
              </div>
            </div>
          )}

          <section>
            <h3 className="mb-2 text-sm font-semibold"><LocalizedText message="Definition" /></h3>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-xs text-ink-3"><LocalizedText message="Numerator" /></dt>
                <dd className="text-ink-2">{r.numerator_def}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-3"><LocalizedText message="Denominator" /></dt>
                <dd className="text-ink-2">{r.denominator_def}</dd>
              </div>
              {r.exclusions && (
                <div>
                  <dt className="text-xs text-ink-3"><LocalizedText message="Exclusions" /></dt>
                  <dd className="text-ink-2">{r.exclusions}</dd>
                </div>
              )}
            </dl>
          </section>

          {data.previous.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold"><LocalizedText message="Previous months" /></h3>
              <Table className="data-table rounded border border-line">
                <TableBody>
                  {data.previous.map((p) => (
                    <TableRow key={p.period}>
                      <TableCell>{fmtPeriod(p.period)}</TableCell>
                      <TableCell className="num right text-ink-3">
                        {fmtNumber(p.numerator, r.unit === "minutes" ? 1 : 0)} / {fmtNumber(p.denominator)}
                      </TableCell>
                      <TableCell className="num right font-medium">{fmtValue(p.value, r.unit)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
          )}

          {data.issues.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold"><LocalizedText message="Validation" /></h3>
              <ul className="space-y-2">
                {data.issues.map((i) => (
                  <li key={i.id} className="rounded border border-line p-2.5 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge tone={i.status !== "open" ? "neutral" : i.severity === "blocking" ? "bad" : "warn"}>{i.rule_code}</Badge>
                      <span className="text-xs text-ink-3">{humanize(i.status)}</span>
                    </div>
                    <p className="mt-1 text-ink-2">{i.message}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h3 className="mb-3 text-sm font-semibold"><LocalizedText message="Review trail" /></h3>
            {data.reviews.length === 0 ? (
              <p className="text-sm text-ink-3"><LocalizedText message="No review actions yet." /></p>
            ) : (
              <ol className="relative space-y-4 border-l border-line pl-5">
                {data.reviews.map((rv) => (
                  <li key={rv.id} className="relative">
                    <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-panel bg-primary" />
                    <div className="text-sm">
                      <span className="font-medium">{humanize(rv.action)}</span>
                      {rv.from_status && rv.to_status && rv.from_status !== rv.to_status && (
                        <span className="text-ink-3">
                          {" "}
                          {rv.from_status} → {rv.to_status}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-ink-3">
                      {rv.user_name ?? <LocalizedText message="System" />} · {fmtDateTime(rv.created_at)}
                    </div>
                    {rv.comment && <p className="mt-1 rounded bg-surface px-2.5 py-1.5 text-sm text-ink-2">{rv.comment}</p>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}
      <PromptModal
        open={!!prompt}
        onClose={() => setPrompt(null)}
        title={prompt?.label ?? ""}
        description={prompt?.id === "reject" ? "The data owner will see your comment and must correct the result before resubmitting." : "The result goes back to draft so it can be corrected."}
        label="What needs to change"
        required
        danger={prompt?.id === "reject"}
        confirmLabel={prompt?.label ?? "Confirm"}
        onConfirm={(text) => act(prompt!.id, text)}
      />
    </Drawer>
  );
}
