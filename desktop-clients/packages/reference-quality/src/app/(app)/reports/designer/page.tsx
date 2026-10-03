"use client";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { SourceButton } from "../../../../components/controls";

import { ReferenceLink as Link } from "@pepbits/reference-host";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "../../../../lib/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, BarChart3, CheckSquare, Gauge, LineChart, ListChecks, Plus, Save, ShieldCheck, Table2, Timer, Trash2, Type } from "lucide-react";
import { useQualityApi } from "../../../../lib/api";
import { useApi, useDebounced } from "../../../../lib/hooks";
import { useAuth, useMeta } from "../../../../lib/auth";
import { Button, Checkbox, EmptyState, ErrorState, Field, Input, Loading, PageHeader, Panel, Select, Textarea } from "../../../../components/ui";
import { FacilityPicker, PeriodPicker, quarterOptions } from "../../../../components/PeriodPicker";
import { ReportRenderer, type RenderedReport } from "../../../../components/ReportRenderer";
import { useToast } from "../../../../components/toast";
import { cls } from "../../../../lib/format";
import { useQualityFormat } from "../../../../lib/format";
import type { Indicator, ReportConfig, ReportSection } from "../../../../lib/types";

const SECTION_TYPES: { type: ReportSection["type"]; label: string; description: string; icon: typeof Gauge }[] = [
  { type: "scorecard", label: "Scorecard", description: "Counts on target, watch and off target, with the exceptions listed", icon: Gauge },
  { type: "kpi_table", label: "Indicator table", description: "Numerator, denominator, result and status, optionally by facility", icon: Table2 },
  { type: "kpi_trend", label: "Trend chart", description: "One indicator over several months against its target", icon: LineChart },
  { type: "facility_comparison", label: "Facility comparison", description: "One indicator compared across facilities", icon: BarChart3 },
  { type: "tat_summary", label: "Turnaround times", description: "Median, 90th percentile and % within target from Event Pulse", icon: Timer },
  { type: "verification_status", label: "Verification status", description: "How many results are approved, verified, submitted or draft", icon: CheckSquare },
  { type: "validation_summary", label: "Validation summary", description: "Open and closed data quality issues", icon: ShieldCheck },
  { type: "text", label: "Text", description: "Commentary, declarations or methodology notes", icon: Type },
];

const newId = () => Math.random().toString(36).slice(2, 10);

function DesignerInner() {
  const { t } = useLocalization();
  const { api } = useQualityApi();
  const meta = useMeta();
  const { can } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const editId = params.get("id");
  const existing = useApi<{ id: number; name: string; description: string | null; program: string | null; authority_id: number | null; kind: string; config: ReportConfig }>(editId ? `/report-templates/${editId}` : null);
  const indicators = useApi<Indicator[]>("/indicators");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [program, setProgram] = useState("");
  const [authority, setAuthority] = useState("");
  const [sections, setSections] = useState<ReportSection[]>([]);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const q = quarterOptions(meta.periods)[0]?.[1];
  const [range, setRange] = useState(q ?? { from: meta.latestPeriod ?? "", to: meta.latestPeriod ?? "" });
  const [facilities, setFacilities] = useState<number[]>([]);
  const [preview, setPreview] = useState<RenderedReport | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    if (!existing.data) return;
    setName(existing.data.name);
    setDescription(existing.data.description ?? "");
    setProgram(existing.data.program ?? "");
    setAuthority(existing.data.authority_id ? String(existing.data.authority_id) : "");
    setSections(existing.data.config.sections);
  }, [existing.data]);

  useEffect(() => {
    if (!editId && sections.length === 0) {
      setName(t("Untitled report"));
      setSections([
        { id: newId(), type: "scorecard", title: t("Performance against target") },
        { id: newId(), type: "kpi_table", title: t("Indicators"), program: "JAWDA", breakdown: "none" },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const configKey = useDebounced(JSON.stringify({ sections, range, facilities }), 550);
  useEffect(() => {
    const { sections: s, range: r, facilities: f } = JSON.parse(configKey) as { sections: ReportSection[]; range: { from: string; to: string }; facilities: number[] };
    if (!s.length || !r.from) return;
    let cancelled = false;
    setPreviewing(true);
    api<RenderedReport>("/reports/preview", { body: { config: { sections: s }, from: r.from, to: r.to, facilityIds: f } })
      .then((res) => {
        if (!cancelled) {
          setPreview(res);
          setPreviewError(null);
        }
      })
      .catch((e) => !cancelled && setPreviewError(e instanceof Error ? e.message : "Preview failed."))
      .finally(() => !cancelled && setPreviewing(false));
    return () => {
      cancelled = true;
    };
  }, [configKey]);

  const update = (id: string, patch: Partial<ReportSection>) => setSections((all) => all.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const move = (idx: number, dir: -1 | 1) =>
    setSections((all) => {
      const next = [...all];
      const [item] = next.splice(idx, 1);
      next.splice(idx + dir, 0, item);
      return next;
    });
  const add = (type: ReportSection["type"]) => {
    const def = SECTION_TYPES.find((t) => t.type === type)!;
    const firstInd = indicators.data?.[0]?.id;
    const base: ReportSection = { id: newId(), type, title: t(def.label) };
    if (type === "kpi_table" || type === "scorecard") Object.assign(base, { domain: meta.domains[0], breakdown: "none" });
    if (type === "kpi_trend") Object.assign(base, { indicatorId: firstInd, months: 12 });
    if (type === "facility_comparison") Object.assign(base, { indicatorId: firstInd });
    if (type === "tat_summary") Object.assign(base, { tatDefinitionIds: meta.tatDefinitions.slice(0, 3).map((d) => d.id) });
    if (type === "text") Object.assign(base, { body: "" });
    setSections((s) => [...s, base]);
    setAdding(false);
  };

  const save = async () => {
    setSaving(true);
    const body = { name, description, program, authority_id: authority ? Number(authority) : null, config: { sections } };
    try {
      if (editId && existing.data?.kind === "custom") {
        await api(`/report-templates/${editId}`, { method: "PUT", body });
        toast("Saved {value0}.", "success", { value0: name });
        router.push(`/reports/${editId}`);
      } else {
        const r = await api<{ id: number }>("/report-templates", { body });
        toast("Created {value0}.", "success", { value0: name });
        router.push(`/reports/${r.id}`);
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (!can("reports.design")) return <ErrorState message="Your role can view reports but not design them. Ask a quality manager for access." />;
  if (editId && existing.error) return <ErrorState message={existing.error} />;
  if ((editId && !existing.data) || !indicators.data) return <Loading rows={10} />;

  return (
    <>
      <Link href="/reports" className="mb-3 inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" /> <LocalizedText message="Reports" /></Link>
      <PageHeader
        title={editId ? t("Edit {value0}", { value0: existing.data?.name ?? "" }) : "Design a report"}
        description="Build the report from sections. The preview on the right uses live data for the period and facilities you choose."
        actions={
          <Button variant="primary" icon={<Save className="size-4" />} loading={saving} onClick={save}>
            {editId && existing.data?.kind === "custom" ? <LocalizedText message="Save report" /> : <LocalizedText message="Save as new report" />}
          </Button>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[440px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Panel title="Details">
            <div className="space-y-3">
              <Field label="Name">
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Description">
                <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Programme">
                  <Select value={program} onChange={(e) => setProgram(e.target.value)}>
                    <option value=""><LocalizedText message="None" /></option>
                    {meta.programs.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Usually sent to">
                  <Select value={authority} onChange={(e) => setAuthority(e.target.value)}>
                    <option value=""><LocalizedText message="Internal use" /></option>
                    {meta.authorities.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </div>
          </Panel>

          <div className="space-y-3">
            {sections.map((s, idx) => (
              <SectionEditor
                key={s.id}
                section={s}
                index={idx}
                total={sections.length}
                indicators={indicators.data!}
                onChange={(p) => update(s.id, p)}
                onMove={(d) => move(idx, d)}
                onRemove={() => setSections((all) => all.filter((x) => x.id !== s.id))}
              />
            ))}
          </div>

          {adding ? (
            <Panel title="Add a section" actions={<Button size="sm" variant="ghost" onClick={() => setAdding(false)}><LocalizedText message="Cancel" /></Button>} bodyClassName="grid gap-1 p-2">
              {SECTION_TYPES.map((t) => (
                <SourceButton key={t.type} onClick={() => add(t.type)} className="flex items-start gap-3 rounded-md px-3 py-2.5 text-left hover:bg-surface">
                  <t.icon className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>
                    <span className="block text-sm font-medium"><LocalizedText message={t.label} /></span>
                    <span className="block text-xs text-ink-3"><LocalizedText message={t.description} /></span>
                  </span>
                </SourceButton>
              ))}
            </Panel>
          ) : (
            <Button className="w-full" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}><LocalizedText message="Add section" /></Button>
          )}
        </div>

        <div className="min-w-0">
          <div className="sticky top-[72px] space-y-3">
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-panel p-3">
              <span className="mr-1 text-sm font-medium"><LocalizedText message="Preview" /></span>
              <PeriodPicker from={range.from} to={range.to} onChange={(from, to) => setRange({ from, to })} />
              <FacilityPicker value={facilities} onChange={setFacilities} />
              {previewing && <span className="text-xs text-ink-3"><LocalizedText message="Updating…" /></span>}
            </div>
            <div className={cls("max-h-[calc(100vh-170px)] overflow-y-auto rounded-lg", previewing && "opacity-70")}>
              {previewError && <ErrorState message={previewError} />}
              {!sections.length && (
                <Panel>
                  <EmptyState title="This report has no sections" icon={<ListChecks className="size-5" />}><LocalizedText message="Add a section to start the preview." /></EmptyState>
                </Panel>
              )}
              {preview && !previewError && sections.length > 0 && <ReportRenderer report={preview} title={name || t("Untitled report")} description={description} compact />}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function SectionEditor({
  section,
  index,
  total,
  indicators,
  onChange,
  onMove,
  onRemove,
}: {
  section: ReportSection;
  index: number;
  total: number;
  indicators: Indicator[];
  onChange: (p: Partial<ReportSection>) => void;
  onMove: (d: -1 | 1) => void;
  onRemove: () => void;
}) {
  const { fmtMinutes } = useQualityFormat();
  const meta = useMeta();
  const def = SECTION_TYPES.find((t) => t.type === section.type)!;
  const mode = section.indicatorIds?.length ? "pick" : section.program ? "program" : section.domain ? "domain" : "all";
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => indicators.filter((i) => !search || `${i.code} ${i.name}`.toLowerCase().includes(search.toLowerCase())), [indicators, search]);

  return (
    <div className="rounded-lg border border-line bg-panel">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <span className="num w-5 text-center text-xs text-ink-3">{index + 1}</span>
        <def.icon className="size-4 text-primary" />
        <span className="text-xs text-ink-3"><LocalizedText message={def.label} /></span>
        <div className="ml-auto flex">
          <SourceButton disabled={index === 0} onClick={() => onMove(-1)} className="rounded p-1 text-ink-3 hover:bg-surface hover:text-ink disabled:opacity-30" aria-label="Move up">
            <ArrowUp className="size-4" />
          </SourceButton>
          <SourceButton disabled={index === total - 1} onClick={() => onMove(1)} className="rounded p-1 text-ink-3 hover:bg-surface hover:text-ink disabled:opacity-30" aria-label="Move down">
            <ArrowDown className="size-4" />
          </SourceButton>
          <SourceButton onClick={onRemove} className="rounded p-1 text-ink-3 hover:bg-bad-soft hover:text-bad" aria-label="Remove section">
            <Trash2 className="size-4" />
          </SourceButton>
        </div>
      </div>
      <div className="space-y-3 p-3">
        <Field label="Title">
          <Input value={section.title} onChange={(e) => onChange({ title: e.target.value })} />
        </Field>

        {(section.type === "kpi_table" || section.type === "scorecard") && (
          <>
            <Field label="Indicators">
              <Select
                value={mode}
                onChange={(e) => {
                  const m = e.target.value;
                  if (m === "all") onChange({ program: undefined, domain: undefined, indicatorIds: undefined });
                  if (m === "program") onChange({ program: meta.programs[0], domain: undefined, indicatorIds: undefined });
                  if (m === "domain") onChange({ domain: meta.domains[0], program: undefined, indicatorIds: undefined });
                  if (m === "pick") onChange({ indicatorIds: indicators.slice(0, 3).map((i) => i.id), program: undefined, domain: undefined });
                }}
              >
                <option value="all"><LocalizedText message="All active indicators" /></option>
                <option value="program"><LocalizedText message="By programme" /></option>
                <option value="domain"><LocalizedText message="By domain" /></option>
                <option value="pick"><LocalizedText message="Choose indicators" /></option>
              </Select>
            </Field>
            {mode === "program" && (
              <Select aria-label="Programme" value={section.program} onChange={(e) => onChange({ program: e.target.value })}>
                {meta.programs.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </Select>
            )}
            {mode === "domain" && (
              <Select aria-label="Domain" value={section.domain} onChange={(e) => onChange({ domain: e.target.value })}>
                {meta.domains.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </Select>
            )}
            {mode === "pick" && (
              <div className="rounded-md border border-line">
                <Input className="rounded-b-none border-0 border-b" placeholder="Filter indicators" value={search} onChange={(e) => setSearch(e.target.value)} />
                <div className="max-h-48 space-y-1 overflow-y-auto p-2">
                  {filtered.map((i) => (
                    <Checkbox
                      key={i.id}
                      checked={section.indicatorIds?.includes(i.id) ?? false}
                      onChange={(v) => {
                        const next = v ? [...(section.indicatorIds ?? []), i.id] : (section.indicatorIds ?? []).filter((x) => x !== i.id);
                        onChange({ indicatorIds: next.length ? next : [i.id] });
                      }}
                      label={
                        <span className="text-[13px]">
                          <span className="text-ink-3">{i.code}</span> {i.name}
                        </span>
                      }
                    />
                  ))}
                </div>
              </div>
            )}
            {section.type === "kpi_table" && <Checkbox checked={section.breakdown === "facility"} onChange={(v) => onChange({ breakdown: v ? "facility" : "none" })} label="Show a row for each facility" />}
          </>
        )}

        {(section.type === "kpi_trend" || section.type === "facility_comparison") && (
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <Field label="Indicator">
              <Select value={section.indicatorId ?? ""} onChange={(e) => onChange({ indicatorId: Number(e.target.value) })}>
                {indicators.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.code} {i.name}
                  </option>
                ))}
              </Select>
            </Field>
            {section.type === "kpi_trend" && (
              <Field label="Months">
                <Select value={section.months ?? 12} onChange={(e) => onChange({ months: Number(e.target.value) })}>
                  {[6, 12, 24].map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
        )}

        {section.type === "tat_summary" && (
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-line p-2">
            {meta.tatDefinitions.map((d) => (
              <Checkbox
                key={d.id}
                checked={section.tatDefinitionIds?.includes(d.id) ?? false}
                onChange={(v) => {
                  const next = v ? [...(section.tatDefinitionIds ?? []), d.id] : (section.tatDefinitionIds ?? []).filter((x) => x !== d.id);
                  onChange({ tatDefinitionIds: next.length ? next : [d.id] });
                }}
                label={
                  <span className="text-[13px]">
                    {d.name} <span className="text-ink-3">({fmtMinutes(d.target_minutes)})</span>
                  </span>
                }
              />
            ))}
          </div>
        )}

        {section.type === "text" && (
          <Field label="Text">
            <Textarea rows={4} value={section.body ?? ""} onChange={(e) => onChange({ body: e.target.value })} />
          </Field>
        )}
      </div>
    </div>
  );
}

export default function DesignerPage() {
  return (
    <Suspense>
      <DesignerInner />
    </Suspense>
  );
}
