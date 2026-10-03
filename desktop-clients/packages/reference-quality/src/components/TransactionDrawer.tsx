"use client";
import { LocalizedText } from "@pepbits/ops-ui";

import { useApi } from "../lib/hooks";
import { Badge, Drawer, ErrorState, Loading } from "./ui";
import { cls } from "../lib/format";
import { useQualityFormat } from "../lib/format";

interface TxDetail {
  transaction: { id: string; domain: string; facility_name: string; priority: string; attributes: Record<string, unknown>; patient_ref: string; started_at: string; current_state: string; current_state_at: string; is_complete: number };
  stages: string[];
  events: { event_id: string; event_type: string; occurred_at: string; ingested_at: string; source_system: string; source_event_key: string; actor: string | null; event_kind: string; supersedes_event_id: string | null; superseded: boolean; payload: Record<string, unknown> }[];
}

export function TransactionDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { fmtDate, fmtDateTime, fmtMinutes, fmtTime, humanize } = useQualityFormat();
  const { data, error, loading } = useApi<TxDetail>(id ? `/transactions/${encodeURIComponent(id)}` : null);
  const t = data?.transaction;
  const effective = (data?.events ?? []).filter((e) => !e.superseded && e.event_kind !== "retraction");
  const first = effective[0]?.occurred_at;
  const reached = new Set(effective.map((e) => e.event_type));

  return (
    <Drawer open={!!id} onClose={onClose} title={id ?? ""} subtitle={t ? `${t.facility_name}, ${humanize(t.domain)}` : undefined}>
      {error && <ErrorState message={error} />}
      {!data && loading && <Loading rows={6} />}
      {t && data && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <Badge tone={t.is_complete ? "ok" : "warn"} dot>
              {t.is_complete ? <LocalizedText message="Complete" /> : <LocalizedText message="In progress" />}
            </Badge>
            <Badge tone={t.priority === "STAT" ? "bad" : "neutral"}>{t.priority === "STAT" ? <LocalizedText message="STAT" /> : <LocalizedText message="Routine" />}</Badge>
            {Object.entries(t.attributes).map(([k, v]) => (
              <Badge key={k}>
                {humanize(k)}: {String(v)}
              </Badge>
            ))}
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-ink-3"><LocalizedText message="Current state" /></dt>
              <dd className="font-medium">{humanize(t.current_state)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-3"><LocalizedText message="As of" /></dt>
              <dd>{fmtDateTime(t.current_state_at)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-3"><LocalizedText message="Patient reference" /></dt>
              <dd className="font-mono text-xs">{t.patient_ref}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-3"><LocalizedText message="Elapsed" /></dt>
              <dd className="num">{first ? fmtMinutes((Date.parse(t.current_state_at) - Date.parse(first)) / 60000) : "—"}</dd>
            </div>
          </dl>

          <section>
            <h3 className="mb-2 text-sm font-semibold"><LocalizedText message="Expected stages" /></h3>
            <div className="flex flex-wrap gap-1.5">
              {data.stages.map((s) => (
                <span key={s} className={cls("rounded px-2 py-1 text-xs", reached.has(s) ? "bg-primary-soft text-primary" : "border border-dashed border-line-strong text-ink-3")}>
                  {humanize(s)}
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-3"><LocalizedText message="Stages that were not reported are shown as missing. They are never inferred." /></p>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold"><LocalizedText message="Event history" /></h3>
            <ol className="relative space-y-4 border-l border-line pl-5">
              {data.events.map((e, i) => {
                const prev = effective.filter((x) => x.occurred_at <= e.occurred_at && x.event_id !== e.event_id).pop();
                const gap = prev && !e.superseded ? (Date.parse(e.occurred_at) - Date.parse(prev.occurred_at)) / 60000 : null;
                return (
                  <li key={e.event_id} className={cls("relative", e.superseded && "opacity-55")}>
                    <span className={cls("absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-panel", e.event_kind === "correction" ? "bg-warn" : e.superseded ? "bg-ink-3" : "bg-primary")} />
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className={cls("font-medium", e.superseded && "line-through")}>{humanize(e.event_type)}</span>
                      {e.event_kind === "correction" && <Badge tone="warn"><LocalizedText message="Correction" /></Badge>}
                      {e.superseded && <Badge><LocalizedText message="Superseded" /></Badge>}
                      {gap !== null && i > 0 && <span className={cls("num text-xs", gap < 0 ? "font-medium text-bad" : "text-ink-3")}>{gap < 0 ? <LocalizedText message="recorded before previous stage" /> : `+${fmtMinutes(gap)}`}</span>}
                    </div>
                    <div className="num text-xs text-ink-3"><LocalizedText message="Occurred {value0} on {value1} · received {value2}" values={{ value0: fmtTime(e.occurred_at), value1: fmtDate(e.occurred_at), value2: fmtTime(e.ingested_at) }} /></div>
                    <div className="mt-0.5 text-xs text-ink-3">
                      {e.source_system} <LocalizedText message="key" /> <span className="font-mono">{e.source_event_key}</span>
                      {e.actor ? ` · ${e.actor}` : ""}
                    </div>
                    {typeof e.payload.reason === "string" && <p className="mt-1 text-xs text-ink-2">{e.payload.reason}</p>}
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
      )}
    </Drawer>
  );
}
