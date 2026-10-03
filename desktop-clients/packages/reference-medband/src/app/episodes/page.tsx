"use client";

import { CalendarPlus, FolderHeart, Pause, Play, Search, Square } from "lucide-react";
import { ReferenceLink as Link } from "@pepbits/reference-host";
import { useMemo, useState } from "react";
import { encounterType } from "../../lib/encounter-config";
import { useStore } from "../../lib/store";
import type { EpisodeStatus } from "../../lib/types";
import { cx, fullName, normalize } from "../../lib/utils";
import { TYPE_ICON } from "../../components/encounter/type-tag";
import { Input, Segmented, Select } from "../../components/ui/form";
import { useErrorToast, useToast } from "../../components/ui/overlay";
import { Avatar, Badge, Button, EmptyState, LinkButton, Panel } from "../../components/ui/primitives";
import { useMaster } from "../../lib/master";
import { useMedbandFormat } from "../../lib/format";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { medbandPaths } from "../../routes";

const STATUS_TONE: Record<EpisodeStatus, string> = {
  Active: "bg-emerald-50 text-emerald-800",
  "On hold": "bg-amber-50 text-amber-800",
  Closed: "bg-slate-100 text-slate-600",
};

export default function EpisodesPage() {
  const { DEPARTMENTS, department, practitioner } = useMaster();
  const { fmtDate, relativeDay } = useMedbandFormat();
  const { t: tr } = useLocalization();
  const store = useStore();
  const toast = useToast();
  const fail = useErrorToast();
  const [status, setStatus] = useState<EpisodeStatus | "All">("Active");
  const [dept, setDept] = useState("");
  const [q, setQ] = useState("");

  const counts = useMemo(() => {
    const c: Record<EpisodeStatus | "All", number> = { All: store.episodes.length, Active: 0, "On hold": 0, Closed: 0 };
    store.episodes.forEach((e) => c[e.status]++);
    return c;
  }, [store.episodes]);

  const rows = useMemo(() => {
    return store.episodes
      .filter((e) => status === "All" || e.status === status)
      .filter((e) => !dept || e.departmentId === dept)
      .filter((e) => {
        if (!q) return true;
        const p = store.patientById(e.patientId);
        return [e.code, e.title, p ? fullName(p) : "", p?.mrn ?? ""].some((v) => normalize(v).includes(normalize(q)));
      })
      .map((e) => {
        const encs = store.encounters
          .filter((x) => x.episodeId === e.id)
          .sort((a, b) => b.start.localeCompare(a.start));
        return { e, encs, last: encs[0] };
      })
      .sort((a, b) => (b.last?.start ?? b.e.startDate).localeCompare(a.last?.start ?? a.e.startDate));
  }, [store, status, dept, q]);

  const change = (id: string, next: EpisodeStatus, code: string) => {
    store
      .setEpisodeStatus(id, next)
      .then(() => toast({ title: tr("{value0} is now {value1}", { value0: (code) ?? "", value1: tr(next ?? "").toLowerCase() }) }))
      .catch((err) => fail(err, "Could not change the episode"));
  };

  return (
    <div className="mx-auto flex h-full max-w-[1500px] flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-xl font-bold tracking-tight"><LocalizedText message="Episodes of care" /></h1>
          <p className="text-[13px] text-ink-faint"><LocalizedText message="Each episode groups every visit for one health problem, across departments and encounter types." /></p>
        </div>
        <Segmented
          size="sm"
          value={status}
          onChange={setStatus}
          ariaLabel="Episode status"
          options={(["Active", "On hold", "Closed", "All"] as const).map((s) => ({
            value: s,
            label: (
              <span>
                <LocalizedText message={s} /> <span className="text-ink-faint">{counts[s]}</span>
              </span>
            ),
          }))}
        />
      </div>

      <Panel className="flex min-h-[420px] flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-line-soft p-3">
          <div className="w-full sm:w-72">
            <Input icon={<Search className="size-4" />} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Episode, title, patient or MRN" />
          </div>
          <Select className="w-auto" value={dept} placeholder="Any department" onChange={(e) => setDept(e.target.value)} options={DEPARTMENTS.map((d) => ({ value: d.id, label: d.name }))} />
          <span className="ml-auto text-[13px] text-ink-faint"><LocalizedText message={"{value0} episodes"} values={{ value0: (rows.length) ?? "" }} /></span>
        </div>

        <div className="scroll-thin min-h-0 flex-1 overflow-auto">
          {rows.length === 0 ? (
            <EmptyState
              icon={<FolderHeart className="size-5" />}
              title="No episodes here"
              body="Episodes are opened from a patient record or while creating an encounter."
              action={<LinkButton href={medbandPaths.encounterNew()} size="sm"><LocalizedText message="Create encounter" /></LinkButton>}
            />
          ) : (
            <ul className="divide-y divide-line-soft">
              {rows.map(({ e, encs, last }) => {
                const p = store.patientById(e.patientId);
                const d = department(e.departmentId);
                const doc = practitioner(e.practitionerId);
                return (
                  <li key={e.id} className="grid gap-3 px-5 py-3.5 hover:bg-canvas/50 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto] lg:items-center">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{e.title}</span>
                        <Badge tone={STATUS_TONE[e.status]}><LocalizedText message={e.status ?? ""} /></Badge>
                      </div>
                      <p className="truncate text-[12.5px] text-ink-faint">
                        {e.code}, <LocalizedText message={e.kind} />, {d?.name ?? tr("No department")}
                        {doc ? `, ${doc.name}` : ""}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {store.cases
                          .filter((c) => c.episodeId === e.id)
                          .map((c) => (
                            <span key={c.id} title={tr("{value0}, {value1}", { value0: (c.code) ?? "", value1: tr(c.status ?? "") })} className={cx("rounded px-1.5 py-px text-[11.5px] font-medium", c.status === "Open" ? "bg-scrub-50 text-scrub-800" : "bg-canvas text-ink-faint line-through")}>
                              {c.title}
                            </span>
                          ))}
                      </div>
                    </div>

                    {p ? (
                      <Link href={medbandPaths.patient(p.id)} className="flex min-w-0 items-center gap-2.5 rounded-lg hover:text-scrub-700">
                        <Avatar text={`${p.firstName[0]}${p.lastName[0]}`} className="size-8 text-[12px]" />
                        <span className="min-w-0">
                          <span className="block truncate text-[13.5px] font-semibold">{fullName(p)}</span>
                          <span className="block text-[12px] text-ink-faint">{p.mrn}</span>
                        </span>
                      </Link>
                    ) : (
                      <span className="text-ink-faint"><LocalizedText message="Unknown patient" /></span>
                    )}

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1">
                        {encs.slice(0, 8).map((x) => {
                          const t = encounterType(x.type);
                          const Icon = TYPE_ICON[x.type];
                          return (
                            <span key={x.id} title={tr("{value0}, {value1}, {value2}", { value0: (x.code) ?? "", value1: tr(t.label ?? ""), value2: (fmtDate(x.start)) ?? "" })} className={cx("grid size-6 place-items-center rounded-md text-white", t.tone.band)}>
                              <Icon className="size-3" />
                            </span>
                          );
                        })}
                        {encs.length > 8 && <span className="text-[12px] text-ink-faint">+{encs.length - 8}</span>}
                        {encs.length === 0 && <span className="text-[12.5px] text-ink-faint"><LocalizedText message="No visits yet" /></span>}
                      </div>
                      <p className="mt-1 text-[12px] text-ink-faint">
                        {last
                          ? tr(encs.length === 1 ? "{value0} visit, opened {value1}, last {value2}" : "{value0} visits, opened {value1}, last {value2}", { value0: encs.length, value1: fmtDate(e.startDate), value2: relativeDay(last.start).toLowerCase() })
                          : tr(encs.length === 1 ? "{value0} visit, opened {value1}" : "{value0} visits, opened {value1}", { value0: encs.length, value1: fmtDate(e.startDate) })}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 lg:justify-end">
                      {e.status !== "Closed" && (
                        <LinkButton
                          size="sm"
                          variant="secondary"
                          href={medbandPaths.encounterNew({ patientId: e.patientId, episode: e.id, department: e.departmentId })}
                        >
                          <CalendarPlus className="size-4" /> {" "}<LocalizedText message="Add visit" /></LinkButton>
                      )}
                      {e.status === "Active" && (
                        <Button size="sm" variant="ghost" onClick={() => change(e.id, "On hold", e.code)}>
                          <Pause className="size-4" /> {" "}<LocalizedText message="Hold" /></Button>
                      )}
                      {e.status === "On hold" && (
                        <Button size="sm" variant="ghost" onClick={() => change(e.id, "Active", e.code)}>
                          <Play className="size-4" /> {" "}<LocalizedText message="Resume" /></Button>
                      )}
                      {e.status !== "Closed" ? (
                        <Button size="sm" variant="ghost" onClick={() => change(e.id, "Closed", e.code)}>
                          <Square className="size-4" /> {" "}<LocalizedText message="Close" /></Button>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => change(e.id, "Active", e.code)}>
                          <LocalizedText message="Reopen" /></Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Panel>
    </div>
  );
}
