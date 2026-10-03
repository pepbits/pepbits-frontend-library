"use client";

import { CalendarPlus, FolderHeart, Phone, Search, SearchX, ShieldCheck, Stethoscope, UserPlus, UserRound, X } from "lucide-react";
import { ReferenceLink as Link } from "@pepbits/reference-host";
import { useRouter } from "../../lib/navigation";
import { useEffect, useMemo, useState } from "react";
import { ENCOUNTER_TYPES } from "../../lib/encounter-config";
import { EMPTY_FILTERS, countActiveFilters, type PatientFilters } from "../../lib/search";
import { useStore } from "../../lib/store";
import type { Patient } from "../../lib/types";
import { coverageActive, cx, fullName } from "../../lib/utils";
import { CoverageLine, Wristband } from "../../components/patient/wristband";
import { TypeTag } from "../../components/encounter/type-tag";
import { Checkbox, Chip, DateInput, Field, Input, Segmented, Select } from "../../components/ui/form";
import { MultiSelect } from "../../components/ui/overlay";
import { Badge, Button, EmptyState, LinkButton, Panel } from "../../components/ui/primitives";
import { SourceButton } from "../../components/controls";
import { useMaster } from "../../lib/master";
import { useMedbandFormat } from "../../lib/format";
import { useMedbandApi } from "../../lib/store";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { medbandPaths } from "../../routes";

type Section = "patient" | "insurance" | "care";

export default function FindPatientPage() {
  const { DEPARTMENTS, PAYERS, network, networksFor, payer, plan, plansFor, tpa, tpasFor } = useMaster();
  const { fmtDate } = useMedbandFormat();
  const api = useMedbandApi();
  const { t: tr } = useLocalization();
  const store = useStore();
  const router = useRouter();
  const [f, setF] = useState<PatientFilters>(EMPTY_FILTERS);
  const [section, setSection] = useState<Section>("insurance");
  const [sort, setSort] = useState<"name" | "recent" | "mrn">("name");
  const [selectedId, setSelectedId] = useState<string>();

  const set = <K extends keyof PatientFilters>(k: K, v: PatientFilters[K]) => setF((x) => ({ ...x, [k]: v }));

  // Keep dependent insurance filters consistent when the parent choice narrows.
  const setPayers = (payerIds: string[]) =>
    setF((x) => {
      const nets = networksFor(payerIds).map((n) => n.id);
      const networkIds = x.networkIds.filter((id) => nets.includes(id));
      const plans = plansFor(networkIds, payerIds).map((p) => p.id);
      const tpas = tpasFor(payerIds).map((t) => t.id);
      return { ...x, payerIds, networkIds, planIds: x.planIds.filter((id) => plans.includes(id)), tpaIds: x.tpaIds.filter((id) => tpas.includes(id)) };
    });
  const setNetworks = (networkIds: string[]) =>
    setF((x) => {
      const plans = plansFor(networkIds, x.payerIds).map((p) => p.id);
      return { ...x, networkIds, planIds: x.planIds.filter((id) => plans.includes(id)) };
    });

  // Search runs on the server (SQL over patients, coverages, encounters and episodes), debounced while typing.
  const [found, setFound] = useState<Patient[]>([]);
  const [searching, setSearching] = useState(true);
  const [searchError, setSearchError] = useState("");
  const patientCount = store.patients.length;
  useEffect(() => {
    // The request is aborted when the filters change or the page unmounts, and a late answer is ignored.
    const controller = new AbortController();
    setSearching(true);
    const timer = setTimeout(() => {
      api
        .searchPatients(f, { signal: controller.signal })
        .then((r) => !controller.signal.aborted && (setFound(r.patients), setSearchError("")))
        .catch((e) => !controller.signal.aborted && setSearchError((e as Error).message))
        .finally(() => !controller.signal.aborted && setSearching(false));
    }, 180);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [api, f, patientCount]);

  const results = useMemo(
    () =>
      [...found].sort((a, b) =>
        sort === "name" ? fullName(a).localeCompare(fullName(b)) : sort === "mrn" ? a.mrn.localeCompare(b.mrn) : b.createdAt.localeCompare(a.createdAt),
      ),
    [found, sort],
  );

  useEffect(() => {
    if (!results.find((r) => r.id === selectedId)) setSelectedId(results[0]?.id);
  }, [results, selectedId]);

  const selected = store.patientById(selectedId);
  const counts: Record<Section, number> = {
    patient: [f.dob, f.gender, f.city].filter(Boolean).length,
    insurance:
      f.payerIds.length + f.tpaIds.length + f.networkIds.length + f.planIds.length + (f.memberOrPolicy ? 1 : 0) + (f.coverageStatus !== "any" ? 1 : 0) + (f.coverageKind !== "any" ? 1 : 0),
    care: f.encounterTypes.length + (f.departmentId ? 1 : 0) + (f.openEpisode ? 1 : 0),
  };

  const chips: Array<{ key: string; label: string; clear: () => void }> = [
    ...f.payerIds.map((id) => ({ key: id, label: tr("Payer: {value0}", { value0: tr(payer(id)?.short ?? "") }), clear: () => setPayers(f.payerIds.filter((x) => x !== id)) })),
    ...f.tpaIds.map((id) => ({ key: id, label: tr("TPA: {value0}", { value0: (tpa(id)?.name) ?? "" }), clear: () => set("tpaIds", f.tpaIds.filter((x) => x !== id)) })),
    ...f.networkIds.map((id) => ({ key: id, label: tr("Network: {value0}", { value0: (network(id)?.name) ?? "" }), clear: () => setNetworks(f.networkIds.filter((x) => x !== id)) })),
    ...f.planIds.map((id) => ({ key: id, label: tr("Plan: {value0}", { value0: (plan(id)?.name) ?? "" }), clear: () => set("planIds", f.planIds.filter((x) => x !== id)) })),
    ...(f.memberOrPolicy ? [{ key: "m", label: tr("Member/policy: {value0}", { value0: (f.memberOrPolicy) ?? "" }), clear: () => set("memberOrPolicy", "") }] : []),
    ...(f.coverageStatus !== "any" ? [{ key: "cs", label: tr("Coverage {value0}", { value0: (f.coverageStatus) ?? "" }), clear: () => set("coverageStatus", "any") }] : []),
    ...(f.coverageKind !== "any" ? [{ key: "ck", label: f.coverageKind === "insured" ? tr("Insured only") : tr("Self pay only"), clear: () => set("coverageKind", "any") }] : []),
    ...(f.dob ? [{ key: "dob", label: tr("Born {value0}", { value0: (fmtDate(f.dob)) ?? "" }), clear: () => set("dob", "") }] : []),
    ...(f.gender ? [{ key: "g", label: f.gender, clear: () => set("gender", "") }] : []),
    ...(f.city ? [{ key: "city", label: tr("City: {value0}", { value0: (f.city) ?? "" }), clear: () => set("city", "") }] : []),
    ...f.encounterTypes.map((t) => ({ key: t, label: tr("Had {value0}", { value0: tr(ENCOUNTER_TYPES.find((x) => x.code === t)?.label ?? "") }), clear: () => set("encounterTypes", f.encounterTypes.filter((x) => x !== t)) })),
    ...(f.departmentId ? [{ key: "d", label: tr("Seen in {value0}", { value0: (DEPARTMENTS.find((d) => d.id === f.departmentId)?.name) ?? "" }), clear: () => set("departmentId", "") }] : []),
    ...(f.openEpisode ? [{ key: "oe", label: "Has open episode", clear: () => set("openEpisode", false) }] : []),
  ];

  return (
    <div className="mx-auto grid h-full max-w-[1600px] gap-4 p-4 md:p-6 lg:grid-cols-[19rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)_22rem] 2xl:grid-cols-[20rem_minmax(0,1fr)_25rem]">
      {/* ─── Filters ─── */}
      <Panel className="flex min-h-0 flex-col">
        <div className="p-4 pb-3">
          <h1 className="mb-3 text-lg font-bold tracking-tight"><LocalizedText message="Find patient" /></h1>
          <Input
            autoFocus
            icon={<Search className="size-4" />}
            value={f.text}
            onChange={(e) => set("text", e.target.value)}
            placeholder="Name, MRN, phone, ID, member no."
            aria-label="Quick search"
          />
        </div>
        <div className="px-4">
          <Segmented<Section>
            className="w-full"
            ariaLabel="Search section"
            value={section}
            onChange={setSection}
            options={(["patient", "insurance", "care"] as Section[]).map((s) => ({
              value: s,
              label: (
                <span className="inline-flex items-center gap-1.5">
                  {s === "patient" ? tr("Patient") : s === "insurance" ? tr("Insurance") : tr("Visits")}
                  {counts[s] > 0 && <span className="grid size-4 place-items-center rounded-full bg-scrub-600 text-[10px] text-white">{counts[s]}</span>}
                </span>
              ),
            }))}
          />
        </div>

        <div className="scroll-thin min-h-0 flex-1 overflow-auto px-4 py-4">
          {section === "patient" && (
            <div className="flex flex-col gap-3">
              <Field label="Date of birth">
                <DateInput value={f.dob} onChange={(e) => set("dob", e.target.value)} />
              </Field>
              <Field label="Gender">
                <Segmented
                  size="sm"
                  value={f.gender || "Any"}
                  onChange={(v) => set("gender", v === "Any" ? "" : (v as PatientFilters["gender"]))}
                  options={["Any", "Female", "Male", "Other"].map((g) => ({ value: g, label: g }))}
                />
              </Field>
              <Field label="City">
                <Input value={f.city} onChange={(e) => set("city", e.target.value)} placeholder="e.g. Riverside" />
              </Field>
              <p className="text-[12px] text-ink-faint"><LocalizedText message="Name, MRN, phone and national ID are matched by the search box above." /></p>
            </div>
          )}

          {section === "insurance" && (
            <div className="flex flex-col gap-3">
              <Field label="Coverage">
                <Segmented
                  size="sm"
                  value={f.coverageKind}
                  onChange={(v) => set("coverageKind", v)}
                  options={[
                    { value: "any", label: "Any" },
                    { value: "insured", label: "Insured" },
                    { value: "self-pay", label: "Self pay" },
                  ]}
                />
              </Field>
              <Field label="Insurers" hint="Pick one or more payers">
                <MultiSelect ariaLabel="Insurers" values={f.payerIds} onChange={setPayers} placeholder="Any insurer" options={PAYERS.map((p) => ({ value: p.id, label: p.name }))} />
              </Field>
              <Field label="TPA">
                <MultiSelect ariaLabel="TPA" values={f.tpaIds} onChange={(v) => set("tpaIds", v)} placeholder="Any TPA" options={tpasFor(f.payerIds).map((t) => ({ value: t.id, label: t.name }))} />
              </Field>
              <Field label="Plan network">
                <MultiSelect
                  ariaLabel="Plan network"
                  values={f.networkIds}
                  onChange={setNetworks}
                  placeholder="Any network"
                  options={networksFor(f.payerIds).map((n) => ({ value: n.id, label: n.name, group: payer(n.payerId)?.short, sub: tr("{value0} tier", { value0: (n.tier) ?? "" }) }))}
                />
              </Field>
              <Field label="Plan">
                <MultiSelect
                  ariaLabel="Plan"
                  values={f.planIds}
                  onChange={(v) => set("planIds", v)}
                  placeholder="Any plan"
                  options={plansFor(f.networkIds, f.payerIds).map((p) => ({ value: p.id, label: p.name, group: network(p.networkId)?.name }))}
                />
              </Field>
              <Field label="Member ID or policy number">
                <Input value={f.memberOrPolicy} onChange={(e) => set("memberOrPolicy", e.target.value)} placeholder="Full or partial" />
              </Field>
              <Field label="Coverage status">
                <Segmented
                  size="sm"
                  value={f.coverageStatus}
                  onChange={(v) => set("coverageStatus", v)}
                  options={[
                    { value: "any", label: "Any" },
                    { value: "active", label: "Active" },
                    { value: "expired", label: "Expired" },
                  ]}
                />
              </Field>
              <p className="text-[12px] text-ink-faint"><LocalizedText message="Insurance filters match on a single coverage, so payer, network and plan always belong together." /></p>
            </div>
          )}

          {section === "care" && (
            <div className="flex flex-col gap-4">
              <Field label="Has had a visit of type">
                <div className="flex flex-wrap gap-1.5">
                  {ENCOUNTER_TYPES.map((t) => (
                    <Chip
                      key={t.code}
                      on={f.encounterTypes.includes(t.code)}
                      onClick={() => set("encounterTypes", f.encounterTypes.includes(t.code) ? f.encounterTypes.filter((x) => x !== t.code) : [...f.encounterTypes, t.code])}
                    >
                      <LocalizedText message={t.label ?? ""} />
                    </Chip>
                  ))}
                </div>
              </Field>
              <Field label="Seen in department">
                <Select value={f.departmentId} onChange={(e) => set("departmentId", e.target.value)} placeholder="Any department" options={DEPARTMENTS.map((d) => ({ value: d.id, label: d.name }))} />
              </Field>
              <Checkbox checked={f.openEpisode} onChange={(v) => set("openEpisode", v)} label="Has an open episode of care" />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-line-soft px-4 py-3">
          <span className="text-[12.5px] text-ink-faint"><LocalizedText message={"{value0} filters on"} values={{ value0: (countActiveFilters(f)) ?? "" }} /></span>
          <Button size="sm" variant="ghost" onClick={() => setF(EMPTY_FILTERS)} disabled={!countActiveFilters(f) && !f.text}>
            <LocalizedText message="Clear all" /></Button>
        </div>
      </Panel>

      {/* ─── Results ─── */}
      <Panel className="flex min-h-[420px] flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-line-soft px-4 py-3">
          <p className="mr-auto text-sm">
            <span className="font-bold">{results.length}</span> <span className="text-ink-soft"><LocalizedText message={"of {value0} patients"} values={{ value0: (store.patients.length) ?? "" }} /></span>
            {searching && <span className="ml-2 text-[12px] text-ink-faint"><LocalizedText message="Searching" /></span>}
            {searchError && <span className="ml-2 text-[12px] text-rose-700"><LocalizedText message={searchError} /></span>}
          </p>
          <Select
            aria-label="Sort"
            className="h-8 w-auto text-[13px]"
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            options={[
              { value: "name", label: "Sort by name" },
              { value: "recent", label: "Newest registered" },
              { value: "mrn", label: "Sort by MRN" },
            ]}
          />
        </div>
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-b border-line-soft px-4 py-2.5">
            {chips.map((c) => (
              <SourceButton key={c.key} onClick={c.clear} className="inline-flex h-7 items-center gap-1 rounded-full bg-scrub-50 pr-2 pl-3 text-[12px] font-medium text-scrub-800 hover:bg-scrub-100">
                {c.label} <X className="size-3" />
              </SourceButton>
            ))}
          </div>
        )}
        <div className="scroll-thin min-h-0 flex-1 overflow-auto p-2" role="listbox" aria-label={tr("Patients")}>
          {results.length === 0 && (
            <EmptyState
              icon={<SearchX className="size-5" />}
              title="No patient matches these filters"
              body="Remove a filter, or check the member ID on the insurance card."
              action={<LinkButton href={medbandPaths.patientNew()} size="sm"><UserPlus className="size-4" /> {" "}<LocalizedText message="Register new patient" /></LinkButton>}
            />
          )}
          {results.map((p) => (
            <ResultRow
              key={p.id}
              p={p}
              selected={p.id === selectedId}
              onSelect={() => (window.matchMedia("(min-width: 1280px)").matches ? setSelectedId(p.id) : router.push(medbandPaths.patient(p.id)))}
              highlightPayers={f.payerIds}
            />
          ))}
        </div>
      </Panel>

      {/* ─── Preview ─── */}
      <Panel className="hidden min-h-0 flex-col xl:flex">
        {selected ? <Preview p={selected} /> : <EmptyState icon={<UserRound className="size-5" />} title="Select a patient" body="Their insurance, episodes and recent visits show here." />}
      </Panel>
    </div>
  );
}

function ResultRow({ p, selected, onSelect, highlightPayers }: { p: Patient; selected: boolean; onSelect: () => void; highlightPayers: string[] }) {
  const { payer } = useMaster();
  const { ageOf, relativeDay } = useMedbandFormat();
  const { t: tr } = useLocalization();
  const store = useStore();
  const router = useRouter();
  const open = store.episodes.filter((e) => e.patientId === p.id && e.status === "Active").length;
  const last = store.encounters.filter((e) => e.patientId === p.id).sort((a, b) => b.start.localeCompare(a.start))[0];
  return (
    <SourceButton
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      onDoubleClick={() => router.push(medbandPaths.patient(p.id))}
      className={cx("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors", selected ? "bg-scrub-50 ring-1 ring-scrub-200" : "hover:bg-canvas")}
    >
      <span className={cx("h-10 w-1.5 shrink-0 rounded-full", p.allergies ? "bg-rose-500" : "bg-scrub-600")} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">{fullName(p)}</span>
          <span className="shrink-0 text-[12px] text-ink-faint">{ageOf(p.dob)} {p.gender[0]}</span>
        </span>
        <span className="block truncate text-[12.5px] text-ink-soft">
          {p.mrn}, {p.phone}
        </span>
      </span>
      <span className="hidden max-w-[45%] flex-wrap justify-end gap-1 md:flex">
        {p.coverages.length === 0 && <Badge tone="bg-canvas text-ink-soft"><LocalizedText message="Self pay" /></Badge>}
        {p.coverages.map((c) => (
          <Badge
            key={c.id}
            tone={cx(
              highlightPayers.includes(c.payerId) ? "bg-scrub-600 text-white" : "bg-canvas text-ink-soft",
              !coverageActive(c) && "line-through decoration-rose-500",
            )}
          >
            {c.priority[0]} {payer(c.payerId)?.short}
          </Badge>
        ))}
      </span>
      <span className="hidden w-28 shrink-0 text-right text-[12px] text-ink-faint lg:block xl:hidden 2xl:block">
        {open > 0 && <span className="block font-medium text-scrub-700"><LocalizedText message={open === 1 ? "{value0} open episode" : "{value0} open episodes"} values={{ value0: open }} /></span>}
        {last ? tr("Last seen {value0}", { value0: (relativeDay(last.start)) ?? "" }) : tr("No visits yet")}
      </span>
    </SourceButton>
  );
}

function Preview({ p }: { p: Patient }) {
  const { fmtDate, relativeDay } = useMedbandFormat();
  const { t: tr } = useLocalization();
  const store = useStore();
  const episodes = store.episodes.filter((e) => e.patientId === p.id && e.status !== "Closed");
  const recent = store.encounters.filter((e) => e.patientId === p.id).sort((a, b) => b.start.localeCompare(a.start)).slice(0, 3);
  return (
    <div key={p.id} className="animate-fade flex min-h-0 flex-1 flex-col">
      <div className="p-4">
        <Wristband patient={p} />
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-soft">
          <span className="inline-flex items-center gap-1.5"><Phone className="size-3.5" /> {p.phone}</span>
          {p.nationalId && <span><LocalizedText message={"ID {value0}"} values={{ value0: (p.nationalId) ?? "" }} /></span>}
          {p.allergies && <span className="font-semibold text-rose-700"><LocalizedText message={"Allergy: {value0}"} values={{ value0: (p.allergies) ?? "" }} /></span>}
        </div>
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-auto px-4">
        <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-soft"><ShieldCheck className="size-4" /> {" "}<LocalizedText message="Insurance" /></h3>
        <div className="divide-y divide-line-soft">
          {p.coverages.length ? p.coverages.map((c) => <CoverageLine key={c.id} c={c} />) : <p className="py-2 text-[13px] text-ink-faint"><LocalizedText message="Self pay, no insurance on file." /></p>}
        </div>
        <h3 className="mt-4 flex items-center gap-1.5 text-[13px] font-semibold text-ink-soft"><FolderHeart className="size-4" /> {" "}<LocalizedText message="Open episodes" /></h3>
        {episodes.length ? (
          episodes.map((e) => (
            <p key={e.id} className="py-1.5 text-[13px]">
              <span className="font-semibold">{e.title}</span> <span className="text-ink-faint"><LocalizedText message={"since {value0}"} values={{ value0: (fmtDate(e.startDate)) ?? "" }} /></span>
            </p>
          ))
        ) : (
          <p className="py-1.5 text-[13px] text-ink-faint"><LocalizedText message="None open." /></p>
        )}
        <h3 className="mt-4 flex items-center gap-1.5 text-[13px] font-semibold text-ink-soft"><Stethoscope className="size-4" /> {" "}<LocalizedText message="Recent visits" /></h3>
        {recent.map((e) => (
          <div key={e.id} className="flex items-center gap-2 py-1.5 text-[13px]">
            <TypeTag type={e.type} withLabel={false} />
            <span className="min-w-0 flex-1 truncate">{e.chiefComplaint ?? e.services?.join(", ") ?? tr("Visit")}</span>
            <span className="shrink-0 text-ink-faint">{relativeDay(e.start)}</span>
          </div>
        ))}
        {recent.length === 0 && <p className="py-1.5 text-[13px] text-ink-faint"><LocalizedText message="No visits yet." /></p>}
      </div>
      <div className="flex gap-2 border-t border-line-soft p-4">
        <LinkButton href={medbandPaths.encounterNew({ patientId: p.id })} className="flex-1">
          <CalendarPlus className="size-4" /> {" "}<LocalizedText message="New encounter" /></LinkButton>
        <Link href={medbandPaths.patient(p.id)} className="inline-flex h-10 items-center rounded-lg border border-line px-4 text-sm font-medium hover:border-scrub-400">
          <LocalizedText message="Open record" /></Link>
      </div>
    </div>
  );
}
