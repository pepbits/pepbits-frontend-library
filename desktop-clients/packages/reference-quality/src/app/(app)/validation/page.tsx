"use client";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { SourceButton, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableContainer } from "../../../components/controls";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "../../../lib/navigation";
import { Play, Settings2 } from "lucide-react";
import { useQualityApi } from "../../../lib/api";
import { useApi } from "../../../lib/hooks";
import { useAuth, useMeta } from "../../../lib/auth";
import { Badge, Button, Checkbox, Drawer, EmptyState, ErrorState, Field, Input, Loading, Modal, PageHeader, Panel, PromptModal, Select, Tabs, Toggle } from "../../../components/ui";
import { ResultDrawer } from "../../../components/ResultDrawer";
import { useToast } from "../../../components/toast";
import { cls } from "../../../lib/format";
import { useQualityFormat } from "../../../lib/format";

interface Issue {
  id: number;
  rule_code: string;
  rule_name: string;
  scope: string;
  severity: "blocking" | "warning";
  status: "open" | "resolved" | "waived";
  message: string;
  period: string | null;
  indicator_code: string | null;
  facility_code: string | null;
  result_id: number | null;
  assignee: string | null;
  assigned_to: number | null;
  resolver: string | null;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}
interface Rule {
  id: number;
  code: string;
  name: string;
  description: string;
  scope: string;
  severity: string;
  params: Record<string, number>;
  active: number;
  open_issues: number;
}
interface IssuesResponse {
  rows: Issue[];
  summary: { status: string; severity: string; n: number }[];
  lastRun: { started_at: string; user_name: string | null; opened: number; auto_resolved: number; scope: string } | null;
}

function ValidationInner() {
  const { t } = useLocalization();
  const { api } = useQualityApi();
  const { fmtDateTime, fmtPeriod, fmtRelative, humanize } = useQualityFormat();
  const meta = useMeta();
  const { can, user } = useAuth();
  const toast = useToast();
  const params = useSearchParams();
  const [tab, setTab] = useState<"issues" | "rules">("issues");
  const [status, setStatus] = useState(params.get("status") ?? "open");
  const [severity, setSeverity] = useState(params.get("severity") ?? "");
  const [rule, setRule] = useState("");
  const [facility, setFacility] = useState("");
  const [mine, setMine] = useState(params.get("assigned") === "me");
  const [runOpen, setRunOpen] = useState(false);
  const [runPeriods, setRunPeriods] = useState<string[]>(meta.periods.slice(-3));
  const [running, setRunning] = useState(false);
  const [issue, setIssue] = useState<Issue | null>(null);
  const [resultId, setResultId] = useState<number | null>(null);
  const [prompt, setPrompt] = useState<"resolve" | "waive" | null>(null);
  const [editRule, setEditRule] = useState<Rule | null>(null);

  const issues = useApi<IssuesResponse>("/validation/issues", { status, severity, rule, facility, assigned: mine ? "me" : "" });
  const rules = useApi<Rule[]>("/validation/rules");
  const sum = (st: string, sev?: string) => (issues.data?.summary ?? []).filter((s) => s.status === st && (!sev || s.severity === sev)).reduce((a, b) => a + b.n, 0);

  const run = async () => {
    setRunning(true);
    try {
      const r = await api<{ opened: number; autoResolved: number; rules: number }>("/validation/run", { body: { periods: runPeriods } });
      toast("Checked {value0} rules: {value1} new or reopened issues, {value2} resolved automatically.", "success", { value0: r.rules, value1: r.opened, value2: r.autoResolved });
      setRunOpen(false);
      await Promise.all([issues.reload(), rules.reload()]);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Validation failed.", "error");
    } finally {
      setRunning(false);
    }
  };

  const act = async (id: number, action: string, body: Record<string, unknown> = {}) => {
    try {
      await api(`/validation/issues/${id}/${action}`, { body });
      toast({ resolve: "Issue resolved.", waive: "Issue waived.", reopen: "Issue reopened.", assign: "Assignment saved." }[action] ?? "Updated.");
      setPrompt(null);
      if (action !== "assign") setIssue(null);
      await issues.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Action failed.", "error");
    }
  };

  const statCards = [
    { label: "Open blocking", value: sum("open", "blocking"), tone: "text-bad", set: () => { setStatus("open"); setSeverity("blocking"); } },
    { label: "Open warnings", value: sum("open", "warning"), tone: "text-warn", set: () => { setStatus("open"); setSeverity("warning"); } },
    { label: "Resolved", value: sum("resolved"), tone: "", set: () => { setStatus("resolved"); setSeverity(""); } },
    { label: "Waived", value: sum("waived"), tone: "", set: () => { setStatus("waived"); setSeverity(""); } },
  ];

  return (
    <>
      <PageHeader
        title="Validation"
        description="Rules check every result and the event history for missing, impossible or suspicious data. Blocking issues stop results from being submitted, verified or approved."
        meta={issues.data?.lastRun && t("Last run {value0} by {value1} for {value2}", { value0: fmtRelative(issues.data.lastRun.started_at), value1: issues.data.lastRun.user_name ?? t("the system"), value2: issues.data.lastRun.scope.split(",").map(fmtPeriod).join(", ") })}
        actions={
          can("validation.run") && (
            <Button variant="primary" icon={<Play className="size-4" />} onClick={() => setRunOpen(true)}><LocalizedText message="Run validation" /></Button>
          )
        }
      />

      <section className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-4">
        {statCards.map((s) => (
          <SourceButton
            key={s.label}
            onClick={() => {
              s.set();
              setTab("issues");
            }}
            className="bg-panel p-4 text-left hover:bg-surface/60"
          >
            <div className="text-xs text-ink-3"><LocalizedText message={s.label} /></div>
            <div className={cls("num mt-1 text-2xl font-semibold", s.value > 0 && s.tone)}>{s.value}</div>
          </SourceButton>
        ))}
      </section>

      <Panel bodyClassName="p-0">
        <div className="px-4 pt-2">
          <Tabs value={tab} onChange={setTab} items={[{ id: "issues", label: "Issues" }, { id: "rules", label: "Rules", count: rules.data?.length }]} />
        </div>

        {tab === "issues" && (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
              <Select aria-label="Status" className="w-32" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value=""><LocalizedText message="Any status" /></option>
                <option value="open"><LocalizedText message="Open" /></option>
                <option value="resolved"><LocalizedText message="Resolved" /></option>
                <option value="waived"><LocalizedText message="Waived" /></option>
              </Select>
              <Select aria-label="Severity" className="w-36" value={severity} onChange={(e) => setSeverity(e.target.value)}>
                <option value=""><LocalizedText message="Any severity" /></option>
                <option value="blocking"><LocalizedText message="Blocking" /></option>
                <option value="warning"><LocalizedText message="Warning" /></option>
              </Select>
              <Select aria-label="Rule" className="w-72" value={rule} onChange={(e) => setRule(e.target.value)}>
                <option value=""><LocalizedText message="All rules" /></option>
                {rules.data?.map((r) => (
                  <option key={r.id} value={r.code}>
                    {r.code} {r.name}
                  </option>
                ))}
              </Select>
              <Select aria-label="Facility" className="w-52" value={facility} onChange={(e) => setFacility(e.target.value)}>
                <option value=""><LocalizedText message="All facilities" /></option>
                {meta.facilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </Select>
              <Checkbox checked={mine} onChange={setMine} label="Assigned to me" />
            </div>
            {issues.error && (
              <div className="p-4">
                <ErrorState message={issues.error} onRetry={issues.reload} />
              </div>
            )}
            {!issues.data && issues.loading && <Loading className="p-4" rows={8} />}
            {issues.data && issues.data.rows.length === 0 && (
              <EmptyState title="No issues match these filters">{status === "open" ? <LocalizedText message="Nothing is waiting for attention." /> : <LocalizedText message="Try another status or rule." />}</EmptyState>
            )}
            {issues.data && issues.data.rows.length > 0 && (
              <div className={cls("max-h-[640px] overflow-auto", issues.loading && "opacity-60")}>
                <Table className="data-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead><LocalizedText message="Rule" /></TableHead>
                      <TableHead><LocalizedText message="Issue" /></TableHead>
                      <TableHead><LocalizedText message="Period" /></TableHead>
                      <TableHead><LocalizedText message="Assigned to" /></TableHead>
                      <TableHead><LocalizedText message="Status" /></TableHead>
                      <TableHead><LocalizedText message="Updated" /></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {issues.data.rows.map((i) => (
                      <TableRow key={i.id} className="cursor-pointer" onClick={() => setIssue(i)}>
                        <TableCell className="whitespace-nowrap">
                          <Badge tone={i.status !== "open" ? "neutral" : i.severity === "blocking" ? "bad" : "warn"}>{i.rule_code}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[560px]">
                          <span className="line-clamp-2 text-ink">{i.message}</span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-ink-2">{i.period ? fmtPeriod(i.period) : <LocalizedText message="Rolling" />}</TableCell>
                        <TableCell className="text-ink-2">{i.assignee ?? "—"}</TableCell>
                        <TableCell>{humanize(i.status)}</TableCell>
                        <TableCell className="whitespace-nowrap text-ink-3">{fmtRelative(i.updated_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}

        {tab === "rules" && (
          <TableContainer overflow="horizontal">
            {!rules.data && <Loading className="p-4" />}
            <Table className="data-table">
              <TableHeader>
                <TableRow>
                  <TableHead><LocalizedText message="Rule" /></TableHead>
                  <TableHead><LocalizedText message="Checks" /></TableHead>
                  <TableHead><LocalizedText message="Applies to" /></TableHead>
                  <TableHead><LocalizedText message="Severity" /></TableHead>
                  <TableHead className="right"><LocalizedText message="Open issues" /></TableHead>
                  <TableHead><LocalizedText message="Active" /></TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.data?.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium whitespace-nowrap">{r.code}</TableCell>
                    <TableCell className="max-w-[460px]">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-ink-3">{r.description}</div>
                    </TableCell>
                    <TableCell className="text-ink-2">{{ result: "Indicator results", completeness: "Reporting completeness", events: "Event Pulse" }[r.scope] ?? r.scope}</TableCell>
                    <TableCell>
                      <Badge tone={r.severity === "blocking" ? "bad" : "warn"}>{humanize(r.severity)}</Badge>
                    </TableCell>
                    <TableCell className="num right">{r.open_issues}</TableCell>
                    <TableCell>{r.active ? <LocalizedText message="Yes" /> : <span className="text-ink-3"><LocalizedText message="Off" /></span>}</TableCell>
                    <TableCell className="right">
                      {can("validation.rules") && (
                        <Button size="sm" variant="ghost" icon={<Settings2 className="size-3.5" />} onClick={() => setEditRule(r)}><LocalizedText message="Configure" /></Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Panel>

      <Drawer open={!!issue} onClose={() => setIssue(null)} title={issue ? `${issue.rule_code} ${issue.rule_name}` : ""} subtitle={issue ? t("Issue #{value0}", { value0: issue.id }) : undefined}>
        {issue && (
          <div className="space-y-5 text-sm">
            <div className="flex gap-2">
              <Badge tone={issue.severity === "blocking" ? "bad" : "warn"}>{humanize(issue.severity)}</Badge>
              <Badge tone={issue.status === "open" ? "warn" : "ok"}>{humanize(issue.status)}</Badge>
            </div>
            <p className="text-ink">{issue.message}</p>
            <dl className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-xs text-ink-3"><LocalizedText message="Indicator" /></dt>
                <dd>{issue.indicator_code ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-3"><LocalizedText message="Facility" /></dt>
                <dd>{issue.facility_code ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-3"><LocalizedText message="Period" /></dt>
                <dd>{issue.period ? fmtPeriod(issue.period) : <LocalizedText message="Rolling event window" />}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-3"><LocalizedText message="First detected" /></dt>
                <dd>{fmtDateTime(issue.created_at)}</dd>
              </div>
            </dl>
            {issue.resolution_note && (
              <div className="rounded-md bg-surface p-3">
                <div className="text-xs text-ink-3">{issue.resolver ? <LocalizedText message="{value0} by {value1} {value2}" values={{ value0: humanize(issue.status), value1: issue.resolver, value2: issue.resolved_at ? fmtRelative(issue.resolved_at) : "" }} /> : <LocalizedText message="{value0} by a validation run {value1}" values={{ value0: humanize(issue.status), value1: issue.resolved_at ? fmtRelative(issue.resolved_at) : "" }} />}</div>
                <p className="mt-1 text-ink-2">{issue.resolution_note}</p>
              </div>
            )}
            {issue.status === "open" && can("validation.resolve") && (
              <Field label="Assigned to">
                <Select
                  value={issue.assigned_to ?? ""}
                  onChange={(e) => {
                    const v = e.target.value ? Number(e.target.value) : null;
                    setIssue({ ...issue, assigned_to: v });
                    void act(issue.id, "assign", { userId: v });
                  }}
                >
                  <option value=""><LocalizedText message="Unassigned" /></option>
                  {meta.users
                    .filter((u) => u.status === "active")
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                        {u.id === user?.id ? <LocalizedText message=" (you)" /> : ""}
                      </option>
                    ))}
                </Select>
              </Field>
            )}
            <div className="flex flex-wrap gap-2">
              {issue.result_id && <Button onClick={() => setResultId(issue.result_id)}><LocalizedText message="Open result" /></Button>}
              {issue.status === "open" && can("validation.resolve") && (
                <Button variant="primary" onClick={() => setPrompt("resolve")}><LocalizedText message="Mark resolved" /></Button>
              )}
              {issue.status === "open" && can("validation.waive") && <Button onClick={() => setPrompt("waive")}><LocalizedText message="Waive" /></Button>}
              {issue.status !== "open" && can("validation.resolve") && <Button onClick={() => act(issue.id, "reopen")}><LocalizedText message="Reopen" /></Button>}
            </div>
            <p className="text-xs text-ink-3"><LocalizedText message="The next validation run reopens a resolved issue if the condition is still present, and closes open issues whose condition has gone." /></p>
          </div>
        )}
      </Drawer>

      <PromptModal
        open={!!prompt}
        onClose={() => setPrompt(null)}
        title={prompt === "waive" ? "Waive issue" : "Resolve issue"}
        description={prompt === "waive" ? "Waiving accepts the data as it is. Explain why; the reason is kept in the audit trail." : "Describe how the data was corrected or confirmed."}
        label={prompt === "waive" ? "Reason" : "Resolution"}
        required
        confirmLabel={prompt === "waive" ? "Waive issue" : "Mark resolved"}
        onConfirm={(t) => act(issue!.id, prompt!, { note: t })}
      />

      <Modal
        open={runOpen}
        onClose={() => setRunOpen(false)}
        title="Run validation"
        description="All active rules run against the selected periods. Event rules always check the rolling event window."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRunOpen(false)}><LocalizedText message="Cancel" /></Button>
            <Button variant="primary" loading={running} disabled={!runPeriods.length} onClick={run}><LocalizedText message="Run validation" /></Button>
          </>
        }
      >
        <div className="grid grid-cols-3 gap-2">
          {[...meta.periods].reverse().map((p) => (
            <Checkbox key={p} checked={runPeriods.includes(p)} onChange={(v) => setRunPeriods((s) => (v ? [...s, p] : s.filter((x) => x !== p)))} label={fmtPeriod(p)} />
          ))}
        </div>
      </Modal>

      <RuleModal
        rule={editRule}
        onClose={() => setEditRule(null)}
        onSaved={() => {
          setEditRule(null);
          void rules.reload();
        }}
      />
      <ResultDrawer resultId={resultId} onClose={() => setResultId(null)} onChanged={issues.reload} />
    </>
  );
}

const PARAM_LABELS: Record<string, string> = {
  threshold: "Change threshold as a fraction (0.35 means 35%)",
  maxMinutes: "Maximum plausible minutes",
  maxRate: "Maximum plausible rate per 1,000",
  lookbackDays: "Look back (days)",
  staleHours: "Stale after (hours)",
  minEvents: "Minimum events before comparing rates",
};

function RuleModal({ rule, onClose, onSaved }: { rule: Rule | null; onClose: () => void; onSaved: () => void }) {
  const { api } = useQualityApi();
  const toast = useToast();
  const [severity, setSeverity] = useState("warning");
  const [active, setActive] = useState(true);
  const [params, setParams] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!rule) return;
    setSeverity(rule.severity);
    setActive(!!rule.active);
    setParams(Object.fromEntries(Object.entries(rule.params).map(([k, v]) => [k, String(v)])));
  }, [rule]);

  const save = async () => {
    setBusy(true);
    try {
      await api(`/validation/rules/${rule!.id}`, { method: "PUT", body: { severity, active, params: Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Number(v)])) } });
      toast("Saved {value0}. Run validation to apply the change.", "success", { value0: rule!.code });
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={!!rule}
      onClose={onClose}
      title={rule ? `${rule.code} ${rule.name}` : ""}
      description={rule?.description}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}><LocalizedText message="Cancel" /></Button>
          <Button variant="primary" loading={busy} onClick={save}><LocalizedText message="Save rule" /></Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Severity" hint="Blocking issues stop results from moving through verification">
          <Select value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="blocking"><LocalizedText message="Blocking" /></option>
            <option value="warning"><LocalizedText message="Warning" /></option>
          </Select>
        </Field>
        {Object.keys(params).map((k) => (
          <Field key={k} label={PARAM_LABELS[k] ?? k}>
            <Input type="number" step="any" value={params[k]} onChange={(e) => setParams((p) => ({ ...p, [k]: e.target.value }))} />
          </Field>
        ))}
        <Toggle checked={active} onChange={setActive} label={active ? "Rule is active" : "Rule is switched off"} />
      </div>
    </Modal>
  );
}

export default function ValidationPage() {
  return (
    <Suspense>
      <ValidationInner />
    </Suspense>
  );
}
