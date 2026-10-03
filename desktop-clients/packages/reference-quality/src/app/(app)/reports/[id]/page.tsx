"use client";
import { LocalizedText, useLocalization, PrintDocument } from "@pepbits/ops-ui";

import { ReferenceLink as Link } from "@pepbits/reference-host";
import { useEffect, useState } from "react";
import { useRouter } from "../../../../lib/navigation";
import { ArrowLeft, Download, Pencil, Printer, Send } from "lucide-react";
import { useQualityApi } from "../../../../lib/api";
import { useApi } from "../../../../lib/hooks";
import { useAuth, useMeta } from "../../../../lib/auth";
import { Button, ErrorState, Field, Loading, Modal, PageHeader, Panel, Select } from "../../../../components/ui";
import { FacilityPicker, PeriodPicker, quarterOptions } from "../../../../components/PeriodPicker";
import { ReportRenderer, type RenderedReport } from "../../../../components/ReportRenderer";
import { useToast } from "../../../../components/toast";
import { cls } from "../../../../lib/format";
import { useQualityFormat } from "../../../../lib/format";
import type { ReportConfig } from "../../../../lib/types";

interface TemplateDetail {
  id: number;
  name: string;
  description: string | null;
  kind: string;
  program: string | null;
  authority_id: number | null;
  authority_name: string | null;
  config: ReportConfig;
  runs: { id: number; period_from: string; period_to: string; trigger: string; generated_by_name: string | null; generated_at: string; checksum: string }[];
}

export default function ReportViewerPage({ params }: { params: { id: string } }) {
  const { api, download } = useQualityApi();
  const { fmtPeriodRange, fmtRelative } = useQualityFormat();
  const { id } = params;
  const meta = useMeta();
  const { can } = useAuth();
  const toast = useToast();
  const { t: tr } = useLocalization();
  const router = useRouter();
  const tpl = useApi<TemplateDetail>(`/report-templates/${id}`);
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [facilities, setFacilities] = useState<number[]>([]);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!tpl.data || range) return;
    const latest = meta.latestPeriod ?? meta.periods[meta.periods.length - 1];
    const quarterly = tpl.data.program === "JAWDA";
    const q = quarterOptions(meta.periods)[0]?.[1];
    setRange(quarterly && q ? q : { from: latest, to: latest });
  }, [tpl.data, range, meta]);

  const report = useApi<RenderedReport>(range ? `/report-templates/${id}/render` : null, range ? { from: range.from, to: range.to, facility: facilities } : undefined);

  const print = async () => {
    if (!range) return;
    try {
      await api(`/report-templates/${id}/render`, { query: { from: range.from, to: range.to, facility: facilities, record: 1 } });
      void tpl.reload();
    } catch {
      /* printing still works without the run record */
    }
    setPrinting(true);
  };

  // The report prints through the shared PrintDocument surface: only the report is on paper, never the host page.
  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener("afterprint", done);
    // Let the charts measure their now-visible print container before the browser captures the page.
    const timer = setTimeout(() => window.print(), 400);
    return () => { clearTimeout(timer); window.removeEventListener("afterprint", done); };
  }, [printing]);

  const exportCsv = async () => {
    if (!range) return;
    try {
      await download(`/report-templates/${id}/export.csv`, { from: range.from, to: range.to, facility: facilities });
      toast("CSV exported. The export is recorded in the audit trail.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Export failed.", "error");
    }
  };

  if (tpl.error) return <ErrorState message={tpl.error} onRetry={tpl.reload} />;
  if (!tpl.data || !range) return <Loading rows={10} />;
  const t = tpl.data;

  return (
    <>
      <Link href="/reports" className="no-print mb-3 inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" /> <LocalizedText message="Reports" /></Link>
      <div className="no-print">
        <PageHeader
          title={t.name}
          description={t.authority_name ? tr("Prepared for {value0}.", { value0: t.authority_name }) : undefined}
          actions={
            <>
              {can("reports.design") && t.kind === "custom" && (
                <Link href={`/reports/designer?id=${t.id}`}>
                  <Button icon={<Pencil className="size-4" />}><LocalizedText message="Edit design" /></Button>
                </Link>
              )}
              <Button icon={<Download className="size-4" />} onClick={exportCsv}><LocalizedText message="Export CSV" /></Button>
              <Button icon={<Printer className="size-4" />} onClick={print}><LocalizedText message="Print or save PDF" /></Button>
              {can("submissions.manage") && (
                <Button variant="primary" icon={<Send className="size-4" />} onClick={() => setSubmitOpen(true)}><LocalizedText message="Prepare submission" /></Button>
              )}
            </>
          }
        />
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-panel p-3">
          <PeriodPicker from={range.from} to={range.to} onChange={(from, to) => setRange({ from, to })} />
          <FacilityPicker value={facilities} onChange={setFacilities} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className={cls(report.loading && "opacity-60")}>
          {report.error && <ErrorState message={report.error} onRetry={report.reload} />}
          {!report.data && report.loading && <Loading rows={10} />}
          {report.data && <ReportRenderer report={report.data} title={t.name} description={t.description} />}
          {printing && report.data && (
            <PrintDocument>
              <div className="reference-quality" data-theme="print">
                <ReportRenderer report={report.data} title={t.name} description={t.description} />
              </div>
            </PrintDocument>
          )}
        </div>
        <aside className="no-print space-y-6">
          <Panel title="Generated runs" description="Each printed, scheduled or submitted run is kept with its checksum" bodyClassName="divide-y divide-line">
            {t.runs.length === 0 && <p className="p-4 text-sm text-ink-3"><LocalizedText message="No runs recorded yet." /></p>}
            {t.runs.map((r) => (
              <div key={r.id} className="px-4 py-3 text-sm">
                <div className="font-medium">{fmtPeriodRange(r.period_from, r.period_to)}</div>
                <div className="text-xs text-ink-3">
                  {r.trigger === "schedule" ? <LocalizedText message="Scheduled run" /> : <LocalizedText message="By {value0}" values={{ value0: r.generated_by_name ?? tr("unknown") }} />}, {fmtRelative(r.generated_at)}
                </div>
                <div className="font-mono text-[11px] text-ink-3">{r.checksum.slice(0, 16)}…</div>
              </div>
            ))}
          </Panel>
        </aside>
      </div>

      <PrepareSubmission
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        templateId={t.id}
        defaultAuthority={t.authority_id}
        range={range}
        facilities={facilities}
        onDone={(sid) => router.push(`/submissions?open=${sid}`)}
      />
    </>
  );
}

function PrepareSubmission({ open, onClose, templateId, defaultAuthority, range, facilities, onDone }: { open: boolean; onClose: () => void; templateId: number; defaultAuthority: number | null; range: { from: string; to: string }; facilities: number[]; onDone: (id: number) => void }) {
  const { api } = useQualityApi();
  const { fmtPeriodRange } = useQualityFormat();
  const meta = useMeta();
  const toast = useToast();
  const [authority, setAuthority] = useState(defaultAuthority ? String(defaultAuthority) : "");
  const { t: tr } = useLocalization();
  const [format, setFormat] = useState("xlsx");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setAuthority(defaultAuthority ? String(defaultAuthority) : "");
  }, [open, defaultAuthority]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Prepare submission"
      description={tr("Freezes this report for {value0} with a checksum. An approver must approve it before it is transmitted.", { value0: fmtPeriodRange(range.from, range.to) })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}><LocalizedText message="Cancel" /></Button>
          <Button
            variant="primary"
            loading={busy}
            disabled={!authority}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await api<{ id: number; reference: string }>("/submissions", { body: { template_id: templateId, authority_id: Number(authority), from: range.from, to: range.to, facilityIds: facilities, format } });
                toast("Prepared {value0}. It is waiting for approval.", "success", { value0: r.reference });
                onDone(r.id);
              } catch (e) {
                toast(e instanceof Error ? e.message : "Could not prepare the submission.", "error");
              } finally {
                setBusy(false);
              }
            }}
          ><LocalizedText message="Prepare submission" /></Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Authority">
          <Select value={authority} onChange={(e) => setAuthority(e.target.value)}>
            <option value=""><LocalizedText message="Choose an authority" /></option>
            {meta.authorities.filter((a) => a.active).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Format">
          <Select value={format} onChange={(e) => setFormat(e.target.value)}>
            <option value="xlsx"><LocalizedText message="Excel workbook" /></option>
            <option value="csv"><LocalizedText message="CSV" /></option>
            <option value="pdf"><LocalizedText message="PDF" /></option>
          </Select>
        </Field>
      </div>
    </Modal>
  );
}
