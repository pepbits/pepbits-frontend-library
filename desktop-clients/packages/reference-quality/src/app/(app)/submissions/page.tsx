"use client";
import { LocalizedText } from "@pepbits/ops-ui";
import { Table, TableContainer, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../components/controls";

import { ReferenceLink as Link } from "@pepbits/reference-host";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "../../../lib/navigation";
import { Check, Info } from "lucide-react";
import { useQualityApi } from "../../../lib/api";
import { useApi } from "../../../lib/hooks";
import { useAuth } from "../../../lib/auth";
import { Badge, Button, Drawer, EmptyState, ErrorState, Loading, PageHeader, Panel, PromptModal, SubmissionStatus, Tabs } from "../../../components/ui";
import { useToast } from "../../../components/toast";
import { cls } from "../../../lib/format";
import { useQualityFormat } from "../../../lib/format";

interface Submission {
  id: number;
  reference: string;
  template_id: number;
  template_name: string;
  authority_name: string | null;
  authority_code: string | null;
  channel: string | null;
  schedule_name: string | null;
  period_from: string;
  period_to: string;
  format: string;
  status: string;
  checksum: string;
  receipt_ref: string | null;
  rejection_reason: string | null;
  created_by_name: string | null;
  approved_by_name: string | null;
  supersedes_reference: string | null;
  superseded_by_reference: string | null;
  created_at: string;
  updated_at: string;
}
interface SubmissionDetail extends Submission {
  created_by: number;
  endpoint: string | null;
  recipients: string[];
  events: { id: number; status: string; note: string | null; user_name: string | null; created_at: string }[];
  run: { id: number; summary: { indicators: number; on_target: number; warning: number; breach: number; approvalCoverage: number | null } } | null;
}

const TABS = [
  { id: "", label: "All" },
  { id: "pending_approval", label: "Awaiting approval" },
  { id: "approved", label: "Approved" },
  { id: "transmitted", label: "Transmitted" },
  { id: "accepted", label: "Accepted" },
  { id: "rejected", label: "Rejected" },
  { id: "cancelled", label: "Cancelled" },
];
const CHANNEL: Record<string, string> = { portal_upload: "Portal upload", sftp: "SFTP", api: "API", email: "Email" };

function SubmissionsInner() {
  const { fmtPeriodRange, fmtRelative } = useQualityFormat();
  const params = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState(params.get("status") ?? "");
  const openId = params.get("open") ? Number(params.get("open")) : null;
  const { data, error, loading, reload } = useApi<{ rows: Submission[]; counts: { status: string; n: number }[] }>("/submissions", { status });
  const counts: Record<string, number> = Object.fromEntries((data?.counts ?? []).map((c) => [c.status, c.n]));
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const setOpen = (id: number | null) => {
    const sp = new URLSearchParams(params.toString());
    if (id) sp.set("open", String(id));
    else sp.delete("open");
    router.replace(`/submissions${sp.toString() ? `?${sp}` : ""}`, { scroll: false });
  };

  return (
    <>
      <PageHeader
        title="Submissions"
        description="Every report sent to an authority, from preparation through approval, transmission and acknowledgement. Submitted content is frozen with a checksum; a rejected submission is replaced by a new linked submission rather than edited."
      />
      <Panel bodyClassName="p-0">
        <div className="px-4 pt-2">
          <Tabs value={status} onChange={setStatus} items={TABS.map((t) => ({ id: t.id, label: t.label, count: t.id ? counts[t.id] ?? 0 : total }))} />
        </div>
        {error && <div className="p-4"><ErrorState message={error} onRetry={reload} /></div>}
        {!data && loading && <Loading className="p-4" rows={6} />}
        {data && data.rows.length === 0 && <EmptyState title="No submissions here"><LocalizedText message="Prepare one from a report, or run a schedule." /></EmptyState>}
        {data && data.rows.length > 0 && (
          <TableContainer overflow="horizontal" className={cls("overflow-x-auto", loading && "opacity-60")}>
            <Table className="data-table">
              <TableHeader>
                <TableRow>
                  <TableHead><LocalizedText message="Reference" /></TableHead>
                  <TableHead><LocalizedText message="Report" /></TableHead>
                  <TableHead><LocalizedText message="Authority" /></TableHead>
                  <TableHead><LocalizedText message="Period" /></TableHead>
                  <TableHead><LocalizedText message="Status" /></TableHead>
                  <TableHead><LocalizedText message="Prepared by" /></TableHead>
                  <TableHead><LocalizedText message="Updated" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((s) => (
                  <TableRow key={s.id} className="cursor-pointer" onClick={() => setOpen(s.id)}>
                    <TableCell className="font-mono text-xs whitespace-nowrap">
                      {s.reference}
                      {s.superseded_by_reference && <div className="font-sans text-[11px] text-ink-3"><LocalizedText message="Replaced by {value0}" values={{ value0: s.superseded_by_reference }} /></div>}
                    </TableCell>
                    <TableCell className="max-w-[260px] truncate">{s.template_name}</TableCell>
                    <TableCell className="text-ink-2">{s.authority_code ?? <LocalizedText message="Internal" />}</TableCell>
                    <TableCell className="whitespace-nowrap text-ink-2">{fmtPeriodRange(s.period_from, s.period_to)}</TableCell>
                    <TableCell>
                      <SubmissionStatus status={s.status} />
                    </TableCell>
                    <TableCell className="text-ink-2">{s.created_by_name ?? (s.schedule_name ? <LocalizedText message="Schedule" /> : "—")}</TableCell>
                    <TableCell className="whitespace-nowrap text-ink-3">{fmtRelative(s.updated_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Panel>
      <SubmissionDrawer id={openId} onClose={() => setOpen(null)} onChanged={reload} onOpen={setOpen} />
    </>
  );
}

const STEPS = [
  { id: "pending_approval", label: "Prepared" },
  { id: "approved", label: "Approved" },
  { id: "transmitted", label: "Transmitted" },
  { id: "accepted", label: "Acknowledged" },
];

function SubmissionDrawer({ id, onClose, onChanged, onOpen }: { id: number | null; onClose: () => void; onChanged: () => void; onOpen: (id: number) => void }) {
  const { api } = useQualityApi();
  const { fmtDateTime, fmtPeriodRange, humanize } = useQualityFormat();
  const { can, user } = useAuth();
  const toast = useToast();
  const { data: s, error, loading, reload } = useApi<SubmissionDetail>(id ? `/submissions/${id}` : null);
  const [busy, setBusy] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<null | { action: string; title: string; label: string; required: boolean; description: string; confirm: string; danger?: boolean }>(null);

  const act = async (action: string, note?: string) => {
    setBusy(action);
    try {
      const r = await api<{ status?: string; reference?: string; id?: number }>(`/submissions/${id}/${action}`, { body: { note } });
      setPrompt(null);
      onChanged();
      if (action === "resubmit" && r.id) {
        toast("Prepared {value0} to replace this submission.", "success", { value0: r.reference ?? "" });
        onOpen(r.id);
      } else {
        toast("{value0} is now {value1}.", "success", { value0: s?.reference ?? "", value1: humanize(r.status ?? action).toLowerCase() });
        await reload();
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Action failed.", "error");
    } finally {
      setBusy(null);
    }
  };

  const stepIndex = s ? (s.status === "rejected" ? 3 : STEPS.findIndex((x) => x.id === s.status)) : -1;
  const ownSubmission = s && user && s.created_by === user.id;

  return (
    <Drawer open={id !== null} onClose={onClose} title={s?.reference ?? "Submission"} subtitle={s ? `${s.template_name}, ${fmtPeriodRange(s.period_from, s.period_to)}` : undefined}>
      {error && <ErrorState message={error} onRetry={reload} />}
      {!s && loading && <Loading rows={6} />}
      {s && (
        <div className="space-y-6 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <SubmissionStatus status={s.status} />
            <Badge>{s.format.toUpperCase()}</Badge>
            {s.schedule_name && <Badge><LocalizedText message="From schedule: {value0}" values={{ value0: s.schedule_name }} /></Badge>}
          </div>

          {s.status !== "cancelled" && (
            <ol className="grid grid-cols-4 gap-1">
              {STEPS.map((step, i) => {
                const done = i <= stepIndex;
                const failed = s.status === "rejected" && i === 3;
                return (
                  <li key={step.id}>
                    <div className={cls("h-1.5 rounded-full", failed ? "bg-bad" : done ? "bg-primary" : "bg-line")} />
                    <div className={cls("mt-1.5 text-xs", done ? "text-ink" : "text-ink-3")}>{failed ? <LocalizedText message="Rejected" /> : <LocalizedText message={step.label} />}</div>
                  </li>
                );
              })}
            </ol>
          )}

          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-xs text-ink-3"><LocalizedText message="Authority" /></dt>
              <dd>{s.authority_name ?? <LocalizedText message="Internal recipients" />}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-3"><LocalizedText message="Channel" /></dt>
              <dd>{s.channel ? (CHANNEL[s.channel] ? <LocalizedText message={CHANNEL[s.channel]} /> : s.channel) : <LocalizedText message="Email" />}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-3"><LocalizedText message="Prepared by" /></dt>
              <dd>{s.created_by_name ?? <LocalizedText message="Schedule" />}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-3"><LocalizedText message="Approved by" /></dt>
              <dd>{s.approved_by_name ?? "—"}</dd>
            </div>
            {s.receipt_ref && (
              <div>
                <dt className="text-xs text-ink-3"><LocalizedText message="Authority receipt" /></dt>
                <dd className="font-mono text-xs">{s.receipt_ref}</dd>
              </div>
            )}
            <div className="col-span-2">
              <dt className="text-xs text-ink-3"><LocalizedText message="Content checksum (SHA-256)" /></dt>
              <dd className="font-mono text-[11px] break-all text-ink-2">{s.checksum}</dd>
            </div>
          </dl>

          {s.run && (
            <div className="rounded-md border border-line p-3">
              <div className="text-xs text-ink-3"><LocalizedText message="Frozen content" /></div>
              <div className="mt-1 text-ink-2"><LocalizedText message="{value0} indicators: {value1} on target, {value2} watch, {value3} off target." values={{ value0: s.run.summary.indicators, value1: s.run.summary.on_target, value2: s.run.summary.warning, value3: s.run.summary.breach }} />{s.run.summary.approvalCoverage !== null && <> <LocalizedText message="{value0}% of results were approved when prepared." values={{ value0: s.run.summary.approvalCoverage }} /></>}</div>
              <Link href={`/reports/${s.template_id}`} className="mt-1 inline-block text-primary hover:underline"><LocalizedText message="Open the report" /></Link>
            </div>
          )}

          {s.rejection_reason && (
            <div className="rounded-md border border-bad/30 bg-bad-soft/60 p-3">
              <div className="text-xs font-medium text-bad"><LocalizedText message="Rejected by the authority" /></div>
              <p className="mt-1 text-ink">{s.rejection_reason}</p>
            </div>
          )}
          {(s.supersedes_reference || s.superseded_by_reference) && (
            <p className="text-ink-2">
              {s.supersedes_reference && <><LocalizedText message="Replaces rejected submission {value0}." values={{ value0: s.supersedes_reference }} /></>}
              {s.superseded_by_reference && <><LocalizedText message="Replaced by {value0}." values={{ value0: s.superseded_by_reference }} /></>}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {s.status === "pending_approval" && can("submissions.approve") && (
              <Button variant="primary" icon={<Check className="size-4" />} loading={busy === "approve"} disabled={!!ownSubmission} title={ownSubmission ? "You prepared this submission, so another approver must approve it." : undefined} onClick={() => act("approve")}><LocalizedText message="Approve for transmission" /></Button>
            )}
            {s.status === "approved" && can("submissions.manage") && (
              <Button variant="primary" loading={busy === "transmit"} onClick={() => act("transmit")}><LocalizedText message="Transmit to {value0}" values={{ value0: s.authority_code ?? "recipients" }} /></Button>
            )}
            {s.status === "transmitted" && can("submissions.manage") && (
              <>
                <Button variant="primary" onClick={() => setPrompt({ action: "accept", title: "Record acknowledgement", label: "Authority receipt reference", required: false, description: "Leave empty to generate a receipt reference.", confirm: "Record acknowledgement" })}><LocalizedText message="Record acknowledgement" /></Button>
                <Button variant="danger" onClick={() => setPrompt({ action: "reject", title: "Record rejection", label: "Reason given by the authority", required: true, description: "The submission stays on record. You can prepare a replacement afterwards.", confirm: "Record rejection", danger: true })}><LocalizedText message="Record rejection" /></Button>
              </>
            )}
            {s.status === "rejected" && !s.superseded_by_reference && can("submissions.manage") && (
              <Button variant="primary" loading={busy === "resubmit"} onClick={() => act("resubmit")}><LocalizedText message="Prepare replacement" /></Button>
            )}
            {["pending_approval", "approved"].includes(s.status) && can("submissions.manage") && (
              <Button variant="ghost" onClick={() => setPrompt({ action: "cancel", title: "Cancel submission", label: "Reason", required: true, description: "The submission will not be transmitted. It stays on record as cancelled.", confirm: "Cancel submission", danger: true })}><LocalizedText message="Cancel" /></Button>
            )}
          </div>
          {ownSubmission && s.status === "pending_approval" && can("submissions.approve") && <p className="text-xs text-ink-3"><LocalizedText message="You prepared this submission, so a different approver must approve it." /></p>}
          {s.status === "transmitted" && (
            <p className="flex items-start gap-2 text-xs text-ink-3">
              <Info className="mt-0.5 size-3.5 shrink-0" /> <LocalizedText message="Delivery is simulated in this demonstration. In production the authority adapter records the acknowledgement automatically." /></p>
          )}

          <section>
            <h3 className="mb-3 text-sm font-semibold"><LocalizedText message="History" /></h3>
            <ol className="relative space-y-4 border-l border-line pl-5">
              {s.events.map((e) => (
                <li key={e.id} className="relative">
                  <span className={cls("absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-panel", e.status === "rejected" || e.status === "cancelled" ? "bg-bad" : e.status === "accepted" ? "bg-ok" : "bg-primary")} />
                  <div className="font-medium">{humanize(e.status)}</div>
                  <div className="text-xs text-ink-3">
                    {e.user_name ?? <LocalizedText message="System" />}, {fmtDateTime(e.created_at)}
                  </div>
                  {e.note && <p className="mt-1 text-ink-2">{e.note}</p>}
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
      <PromptModal
        open={!!prompt}
        onClose={() => setPrompt(null)}
        title={prompt?.title ?? ""}
        description={prompt?.description}
        label={prompt?.label}
        required={prompt?.required}
        danger={prompt?.danger}
        confirmLabel={prompt?.confirm ?? "Confirm"}
        onConfirm={(t) => act(prompt!.action, t)}
      />
    </Drawer>
  );
}

export default function SubmissionsPage() {
  return (
    <Suspense>
      <SubmissionsInner />
    </Suspense>
  );
}
