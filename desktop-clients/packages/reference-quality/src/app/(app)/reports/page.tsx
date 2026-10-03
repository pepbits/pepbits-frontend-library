"use client";
import { ConfirmDialog, LocalizedText, useLocalization } from "@pepbits/ops-ui";

import { ReferenceLink as Link } from "@pepbits/reference-host";
import { useRouter } from "../../../lib/navigation";
import { useState } from "react";
import { Archive, Copy, FilePlus2, Pencil } from "lucide-react";
import { useQualityApi } from "../../../lib/api";
import { useApi } from "../../../lib/hooks";
import { useAuth } from "../../../lib/auth";
import { Badge, Button, ErrorState, Loading, PageHeader, Panel, Tabs } from "../../../components/ui";
import { useToast } from "../../../components/toast";
import { useQualityFormat } from "../../../lib/format";
import type { ReportConfig } from "../../../lib/types";

interface Template {
  id: number;
  name: string;
  description: string | null;
  kind: "system" | "custom";
  program: string | null;
  authority_name: string | null;
  authority_code: string | null;
  config: ReportConfig;
  created_by_name: string | null;
  active_schedules: number;
  last_generated: string | null;
  updated_at: string;
}

export default function ReportsPage() {
  const { api } = useQualityApi();
  const { t: tr } = useLocalization();
  const { fmtRelative } = useQualityFormat();
  const { can } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<"all" | "regulatory" | "internal" | "custom">("all");
  const { data, error, loading, reload } = useApi<Template[]>("/report-templates");
  const rows = (data ?? []).filter((t) =>
    tab === "all" ? true : tab === "custom" ? t.kind === "custom" : tab === "regulatory" ? !!t.authority_code && t.authority_code !== "BOARD" : !t.authority_code || t.authority_code === "BOARD",
  );

  const duplicate = async (t: Template) => {
    try {
      const r = await api<{ id: number }>(`/report-templates/${t.id}/duplicate`, { method: "POST" });
      toast("Created a copy of {value0}.", "success", { value0: t.name });
      router.push(`/reports/designer?id=${r.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not duplicate.", "error");
    }
  };
  const [archiving, setArchiving] = useState<Template | null>(null);
  const archive = async (t: Template) => {
    setArchiving(null);
    try {
      await api(`/report-templates/${t.id}`, { method: "DELETE" });
      toast("Archived {value0}.", "success", { value0: t.name });
      void reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not archive.", "error");
    }
  };

  return (
    <>
      <PageHeader
        title="Reports"
        description="Regulatory packages, board packs and operational reports. Every report is generated from live indicator, validation and event data, with a checksum so the exact output can be evidenced later."
        actions={
          can("reports.design") && (
            <Link href="/reports/designer">
              <Button variant="primary" icon={<FilePlus2 className="size-4" />}><LocalizedText message="Design a report" /></Button>
            </Link>
          )
        }
      />
      <Panel bodyClassName="p-0">
        <div className="px-4 pt-2">
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { id: "all", label: "All", count: data?.length },
              { id: "regulatory", label: "Regulatory" },
              { id: "internal", label: "Internal" },
              { id: "custom", label: "Designed by your team" },
            ]}
          />
        </div>
        {error && <div className="p-4"><ErrorState message={error} onRetry={reload} /></div>}
        {!data && loading && <Loading className="p-4" rows={6} />}
        <ul className="divide-y divide-line">
          {rows.map((t) => (
            <li key={t.id} className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center">
              <Link href={`/reports/${t.id}`} className="min-w-0 flex-1 group">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-ink group-hover:underline">{t.name}</span>
                  {t.authority_name && <Badge tone={t.authority_code === "BOARD" ? "neutral" : "info"}>{t.authority_code === "BOARD" ? <LocalizedText message="Board" /> : <LocalizedText message="For {value0}" values={{ value0: t.authority_code ?? "" }} />}</Badge>}
                  {t.kind === "custom" && <Badge tone="primary"><LocalizedText message="Custom" /></Badge>}
                  {t.active_schedules > 0 && <Badge><LocalizedText message={t.active_schedules > 1 ? "{value0} active schedules" : "{value0} active schedule"} values={{ value0: t.active_schedules }} /></Badge>}
                </div>
                {t.description && <p className="mt-1 line-clamp-2 max-w-[80ch] text-sm text-ink-2">{t.description}</p>}
                <p className="mt-1 text-xs text-ink-3">
                  <LocalizedText message="{value0} sections." values={{ value0: t.config.sections.length }} /> {t.last_generated ? <LocalizedText message="Last generated {value0}." values={{ value0: fmtRelative(t.last_generated) }} /> : <LocalizedText message="Not generated yet." />}
                  {t.kind === "custom" && t.created_by_name ? <> <LocalizedText message="Designed by {value0}." values={{ value0: t.created_by_name }} /></> : ""}
                </p>
              </Link>
              <div className="flex shrink-0 gap-2">
                <Link href={`/reports/${t.id}`}>
                  <Button size="sm" variant="secondary"><LocalizedText message="Open" /></Button>
                </Link>
                {can("reports.design") && t.kind === "custom" && (
                  <Link href={`/reports/designer?id=${t.id}`}>
                    <Button size="sm" variant="ghost" icon={<Pencil className="size-3.5" />}><LocalizedText message="Edit" /></Button>
                  </Link>
                )}
                {can("reports.design") && (
                  <Button size="sm" variant="ghost" icon={<Copy className="size-3.5" />} onClick={() => duplicate(t)}><LocalizedText message="Duplicate" /></Button>
                )}
                {can("reports.design") && t.kind === "custom" && (
                  <Button size="sm" variant="ghost" icon={<Archive className="size-3.5" />} onClick={() => setArchiving(t)} aria-label={tr("Archive {value0}", { value0: t.name })} />
                )}
              </div>
            </li>
          ))}
        </ul>
      </Panel>
      <ConfirmDialog
        open={archiving !== null}
        title={tr("Archive report")}
        message={archiving ? tr("Archive “{value0}”? It will no longer appear in the library.", { value0: archiving.name }) : ""}
        confirmLabel={tr("Archive")}
        tone="danger"
        onConfirm={() => archiving && void archive(archiving)}
        onCancel={() => setArchiving(null)}
      />
    </>
  );
}
