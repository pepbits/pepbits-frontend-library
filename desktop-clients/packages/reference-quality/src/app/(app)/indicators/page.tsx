"use client";
import { LocalizedText } from "@pepbits/ops-ui";
import { Table, TableContainer, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../components/controls";

import { ReferenceLink as Link } from "@pepbits/reference-host";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "../../../lib/navigation";
import { Activity, Plus, Search } from "lucide-react";
import { useApi } from "../../../lib/hooks";
import { useAuth, useMeta } from "../../../lib/auth";
import { Badge, Button, EmptyState, ErrorState, Input, Loading, PageHeader, Panel, Select } from "../../../components/ui";
import { KpiStatusBadge, TargetBand } from "../../../components/kpi";
import { IndicatorForm } from "../../../components/IndicatorForm";
import { unitLabel } from "../../../lib/format";
import { useQualityFormat } from "../../../lib/format";
import type { Indicator, KpiStatus } from "../../../lib/types";

type Row = Indicator & { latest: { period: string; value: number | null; status: KpiStatus; completeness: number | null; approvalCoverage: number | null } };

function IndicatorsInner() {
  const { fmtPeriod, fmtValue } = useQualityFormat();
  const meta = useMeta();
  const { can } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [period, setPeriod] = useState(meta.latestPeriod ?? "");
  const [search, setSearch] = useState("");
  const [domain, setDomain] = useState(params.get("domain") ?? "");
  const [program, setProgram] = useState("");
  const [status, setStatus] = useState("");
  const [creating, setCreating] = useState(false);
  const { data, error, loading, reload } = useApi<Row[]>("/indicators", { period });

  const rows = useMemo(() => {
    const q = search.toLowerCase();
    return (data ?? []).filter(
      (r) =>
        (!q || r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)) &&
        (!domain || r.domain === domain) &&
        (!program || r.program === program) &&
        (!status || r.latest.status === status),
    );
  }, [data, search, domain, program, status]);

  return (
    <>
      <PageHeader
        title="Indicators"
        description="The indicator catalogue with definitions, targets and the latest pooled result across applicable facilities."
        actions={
          can("indicators.manage") && (
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}><LocalizedText message="New indicator" /></Button>
          )
        }
      />
      <Panel bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-ink-3" />
            <Input placeholder="Search by code or name" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select aria-label="Domain" className="w-48" value={domain} onChange={(e) => setDomain(e.target.value)}>
            <option value=""><LocalizedText message="All domains" /></option>
            {meta.domains.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </Select>
          <Select aria-label="Programme" className="w-40" value={program} onChange={(e) => setProgram(e.target.value)}>
            <option value=""><LocalizedText message="All programmes" /></option>
            {meta.programs.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </Select>
          <Select aria-label="Status" className="w-36" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value=""><LocalizedText message="Any status" /></option>
            <option value="on_target"><LocalizedText message="On target" /></option>
            <option value="warning"><LocalizedText message="Watch" /></option>
            <option value="breach"><LocalizedText message="Off target" /></option>
            <option value="no_data"><LocalizedText message="No data" /></option>
          </Select>
          <Select aria-label="Period" className="w-36" value={period} onChange={(e) => setPeriod(e.target.value)}>
            {[...meta.periods].reverse().map((p) => (
              <option key={p} value={p}>
                {fmtPeriod(p)}
              </option>
            ))}
          </Select>
        </div>
        {error && <div className="p-4"><ErrorState message={error} onRetry={reload} /></div>}
        {!data && loading && <Loading className="p-4" rows={8} />}
        {data && rows.length === 0 && <EmptyState title="No indicators match these filters"><LocalizedText message="Clear a filter or search for a different code." /></EmptyState>}
        {data && rows.length > 0 && (
          <TableContainer overflow="horizontal">
            <Table className="data-table">
              <TableHeader>
                <TableRow>
                  <TableHead><LocalizedText message="Indicator" /></TableHead>
                  <TableHead><LocalizedText message="Domain" /></TableHead>
                  <TableHead><LocalizedText message="Programme" /></TableHead>
                  <TableHead className="right">{fmtPeriod(period)}</TableHead>
                  <TableHead className="min-w-[180px]"><LocalizedText message="Against target" /></TableHead>
                  <TableHead><LocalizedText message="Status" /></TableHead>
                  <TableHead className="right"><LocalizedText message="Complete" /></TableHead>
                  <TableHead><LocalizedText message="Source" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => router.push(`/indicators/${r.id}`)}>
                    <TableCell className="max-w-[360px]">
                      <Link href={`/indicators/${r.id}`} className="block" onClick={(e) => e.stopPropagation()}>
                        <span className="text-xs font-medium text-ink-3">{r.code}</span>
                        <span className="block truncate font-medium text-ink hover:underline">{r.name}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-ink-2">{r.domain}</TableCell>
                    <TableCell>
                      <Badge>{r.program}</Badge>
                    </TableCell>
                    <TableCell className="num right font-semibold">{fmtValue(r.latest.value, r.unit)}</TableCell>
                    <TableCell>
                      <TargetBand compact value={r.latest.value} target={r.target} warning={r.warning} direction={r.direction} unit={r.unit} />
                      <div className="num mt-0.5 text-[11px] text-ink-3">
                        {r.direction === "higher" ? "≥" : "≤"} {fmtValue(r.target, r.unit)}
                        {r.unit === "per_1000" ? ` ${unitLabel(r.unit)}` : ""}
                      </div>
                    </TableCell>
                    <TableCell>
                      <KpiStatusBadge status={r.latest.status} />
                    </TableCell>
                    <TableCell className="num right text-ink-2">{r.latest.completeness === null ? "—" : `${r.latest.completeness}%`}</TableCell>
                    <TableCell>
                      {r.source === "events" ? (
                        <span className="inline-flex items-center gap-1 text-xs text-primary">
                          <Activity className="size-3.5" /> <LocalizedText message="Event Pulse" /></span>
                      ) : (
                        <span className="text-xs text-ink-3"><LocalizedText message="Submitted data" /></span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Panel>
      <IndicatorForm open={creating} onClose={() => setCreating(false)} onSaved={(id) => router.push(`/indicators/${id}`)} />
    </>
  );
}

export default function IndicatorsPage() {
  return (
    <Suspense>
      <IndicatorsInner />
    </Suspense>
  );
}
