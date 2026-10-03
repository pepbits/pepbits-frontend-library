"use client";

import { BedDouble, CalendarPlus, FolderHeart, FolderPlus, Lock, Mail, MapPin, Pause, Phone, Play, ShieldCheck, Siren, Stethoscope, UserRound } from "lucide-react";
import { ReferenceLink as Link } from "@pepbits/reference-host";
import { useMemo, useState } from "react";
import { encounterType, START_TYPES } from "../../../lib/encounter-config";
import { useStore } from "../../../lib/store";
import type { AdmissionRequest, Case, Coverage, Encounter, Episode, EpisodeKind } from "../../../lib/types";
import { cx, fullName } from "../../../lib/utils";
import { CoverageEditor } from "../../../components/patient/coverage-editor";
import { CoverageLine, Wristband } from "../../../components/patient/wristband";
import { StatusPill, TypeTag } from "../../../components/encounter/type-tag";
import { Field, Input, Segmented, Select } from "../../../components/ui/form";
import { Modal, useErrorToast, useToast } from "../../../components/ui/overlay";
import { Badge, Button, EmptyState, LinkButton, Panel, PanelHeader } from "../../../components/ui/primitives";
import { useMaster } from "../../../lib/master";
import { useMedbandFormat } from "../../../lib/format";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { Copy } from "../../../components/copy";
import { medbandPaths } from "../../../routes";

const KINDS: EpisodeKind[] = ["Acute illness", "Chronic care", "Maternity", "Surgical", "Rehabilitation", "Preventive", "Oncology"];

/** The record route `/patients/[id]`: the module route context passes the decoded id as an explicit prop (the source read a promise with use()). */
export default function PatientRecordPage({ params }: { params: { id: string } }) {
  const { DEPARTMENTS } = useMaster();
  const { fmtDate } = useMedbandFormat();
  const { t: tr } = useLocalization();
  const { id } = params;
  /** One catalog message per plural form, so every language can inflect the noun. */
  const count = (n: number, one: string, many: string) => tr(n === 1 ? one : many, { value0: n });
  const store = useStore();
  const toast = useToast();
  const fail = useErrorToast();
  const [busy, setBusy] = useState(false);
  const patient = store.patientById(id);
  const [view, setView] = useState<"episodes" | "timeline">("episodes");
  const [editCov, setEditCov] = useState<Coverage[] | null>(null);
  const [newEp, setNewEp] = useState<{ title: string; kind: EpisodeKind; departmentId: string } | null>(null);

  const episodes = useMemo(
    () =>
      store.episodes
        .filter((e) => e.patientId === id)
        .sort((a, b) => (a.status === "Closed" ? 1 : 0) - (b.status === "Closed" ? 1 : 0) || b.startDate.localeCompare(a.startDate)),
    [store.episodes, id],
  );
  const encounters = useMemo(() => store.encounters.filter((e) => e.patientId === id).sort((a, b) => b.start.localeCompare(a.start)), [store.encounters, id]);
  const cases = useMemo(
    () => store.cases.filter((c) => c.patientId === id).sort((a, b) => (a.status === "Closed" ? 1 : 0) - (b.status === "Closed" ? 1 : 0) || b.openedAt.localeCompare(a.openedAt)),
    [store.cases, id],
  );
  const requests = useMemo(() => store.admissionRequests.filter((r) => r.patientId === id), [store.admissionRequests, id]);

  if (!patient) {
    return (
      <div className="p-6">
        <Panel>
          <EmptyState icon={<UserRound className="size-5" />} title="Patient not found" body="The record may have been removed or the link is incomplete." action={<LinkButton href={medbandPaths.patients()}><LocalizedText message="Find patient" /></LinkButton>} />
        </Panel>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full max-w-[1500px] flex-col gap-4 p-4 md:p-6">
      <Panel className="flex flex-wrap items-center gap-4 p-4">
        <Wristband patient={patient} size="lg" className="min-w-0 flex-1 basis-[28rem]" />
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setNewEp({ title: "", kind: "Acute illness", departmentId: "" })}>
            <FolderPlus className="size-4" /> {" "}<LocalizedText message="New episode" /></Button>
          <LinkButton variant="secondary" href={medbandPaths.admissionNew({ patientId: patient.id })}>
            <BedDouble className="size-4" /> {" "}<LocalizedText message="Request admission" /></LinkButton>
          <LinkButton href={medbandPaths.encounterNew({ patientId: patient.id })}>
            <CalendarPlus className="size-4" /> {" "}<LocalizedText message="New encounter" /></LinkButton>
        </div>
      </Panel>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <Panel className="flex min-h-0 flex-col">
          <div className="scroll-thin min-h-0 flex-1 overflow-auto p-5">
            <h2 className="mb-2 text-[13px] font-semibold text-ink-soft"><LocalizedText message="Contact" /></h2>
            <ul className="space-y-1.5 text-[13.5px]">
              <li className="flex items-center gap-2"><Phone className="size-4 text-ink-faint" /> {patient.phone}</li>
              {patient.email && <li className="flex items-center gap-2"><Mail className="size-4 text-ink-faint" /> {patient.email}</li>}
              {(patient.address || patient.city) && <li className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 text-ink-faint" /> {[patient.address, patient.city].filter(Boolean).join(", ")}</li>}
            </ul>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
              <Info k="National ID" v={patient.nationalId} />
              <Info k="Nationality" v={patient.nationality} />
              <Info k="Language" v={patient.preferredLanguage} />
              <Info k="Registered" v={fmtDate(patient.createdAt)} />
              <Info k="Emergency contact" v={[patient.emergencyName, patient.emergencyPhone].filter(Boolean).join(", ")} wide />
              {patient.allergies && <Info k="Allergies" v={patient.allergies} wide alert />}
            </dl>

            <div className="mt-6 mb-1 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-soft"><ShieldCheck className="size-4" /> {" "}<LocalizedText message="Insurance" /></h2>
              <Button size="sm" variant="ghost" onClick={() => setEditCov(patient.coverages)}><LocalizedText message="Manage" /></Button>
            </div>
            <div className="divide-y divide-line-soft">
              {patient.coverages.length ? patient.coverages.map((c) => <CoverageLine key={c.id} c={c} />) : <p className="py-2 text-[13px] text-ink-faint"><LocalizedText message="Self pay" /></p>}
            </div>
          </div>
        </Panel>

        <Panel className="flex min-h-[420px] flex-col">
          <PanelHeader
            title="Care history"
            sub={[
              count(episodes.filter((e) => e.status !== "Closed").length, "{value0} open episode", "{value0} open episodes"),
              count(cases.filter((c) => c.status === "Open").length, "{value0} open case", "{value0} open cases"),
              count(encounters.length, "{value0} encounter", "{value0} encounters"),
            ].join(", ")}
            action={
              <Segmented
                size="sm"
                value={view}
                onChange={setView}
                options={[
                  { value: "episodes", label: "By episode" },
                  { value: "timeline", label: "Timeline" },
                ]}
              />
            }
          />
          <div className="scroll-thin min-h-0 flex-1 overflow-auto px-5 pb-5">
            {view === "episodes" ? (
              episodes.length ? (
                <div className="flex flex-col gap-3">
                  {episodes.map((ep) => (
                    <EpisodeBlock
                      key={ep.id}
                      ep={ep}
                      cases={cases.filter((c) => c.episodeId === ep.id)}
                      encounters={encounters.filter((e) => e.episodeId === ep.id)}
                      requests={requests.filter((r) => r.episodeId === ep.id)}
                      onStatus={(s) =>
                        store
                          .setEpisodeStatus(ep.id, s)
                          .then(() => toast({ title: tr("Episode {value0}", { value0: s === "Closed" ? tr("closed") : s === "On hold" ? tr("put on hold") : tr("reopened") }), body: ep.title }))
                          .catch((e) => fail(e))
                      }
                      onCaseStatus={(c, s) =>
                        store
                          .setCaseStatus(c.id, s)
                          .then(() => toast({ title: tr("Case {value0}", { value0: s === "Closed" ? tr("closed") : tr("reopened") }), body: `${c.code}, ${c.title}` }))
                          .catch((e) => fail(e, "Could not change the case"))
                      }
                    />
                  ))}
                </div>
              ) : (
                <EmptyState icon={<FolderHeart className="size-5" />} title="No episodes yet" body="Creating the first encounter starts an episode automatically." action={<LinkButton href={medbandPaths.encounterNew({ patientId: patient.id })} size="sm"><LocalizedText message="New encounter" /></LinkButton>} />
              )
            ) : (
              <ol className="relative ml-2 border-l-2 border-line-soft">
                {encounters.map((e) => (
                  <li key={e.id} className="relative mb-1 pl-5">
                    <span className={cx("absolute top-4 -left-[7px] size-3 rounded-full ring-4 ring-paper", encounterType(e.type).tone.dot)} />
                    <EncounterRow e={e} showEpisode />
                  </li>
                ))}
                {encounters.length === 0 && <p className="pl-5 text-[13px] text-ink-faint"><LocalizedText message="No encounters yet." /></p>}
              </ol>
            )}
          </div>
        </Panel>
      </div>

      <Modal
        open={!!editCov}
        onClose={() => setEditCov(null)}
        title={tr("Insurance for {value0}", { value0: (fullName(patient)) ?? "" })}
        width="max-w-4xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditCov(null)}><LocalizedText message="Cancel" /></Button>
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await store.updatePatient(patient.id, { coverages: editCov ?? [] });
                  setEditCov(null);
                  toast({ title: "Insurance saved" });
                } catch (e) {
                  fail(e, "Could not save insurance");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? tr("Saving") : tr("Save insurance")}
            </Button>
          </>
        }
      >
        {editCov && <CoverageEditor value={editCov} onChange={setEditCov} />}
      </Modal>

      <Modal
        open={!!newEp}
        onClose={() => setNewEp(null)}
        title="New episode of care"
        footer={
          <>
            <Button variant="ghost" onClick={() => setNewEp(null)}><LocalizedText message="Cancel" /></Button>
            <Button
              disabled={!newEp?.title.trim() || !newEp?.departmentId || busy}
              onClick={async () => {
                if (!newEp) return;
                setBusy(true);
                try {
                  const ep = await store.createEpisode({ patientId: patient.id, title: newEp.title.trim(), kind: newEp.kind, departmentId: newEp.departmentId });
                  setNewEp(null);
                  toast({ title: "Episode created", body: `${ep.code}, ${ep.title}` });
                } catch (e) {
                  fail(e, "Could not create the episode");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <LocalizedText message="Create episode" /></Button>
          </>
        }
      >
        {newEp && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Episode name" required className="sm:col-span-2">
              <Input autoFocus value={newEp.title} onChange={(e) => setNewEp({ ...newEp, title: e.target.value })} placeholder="e.g. Asthma management" />
            </Field>
            <Field label="Kind of care">
              <Select value={newEp.kind} onChange={(e) => setNewEp({ ...newEp, kind: e.target.value as EpisodeKind })} options={KINDS.map((k) => ({ value: k, label: k }))} />
            </Field>
            <Field label="Lead department" required>
              <Select value={newEp.departmentId} placeholder="Choose" onChange={(e) => setNewEp({ ...newEp, departmentId: e.target.value })} options={DEPARTMENTS.map((d) => ({ value: d.id, label: d.name }))} />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}


function Info({ k, v, wide, alert }: { k: string; v?: string; wide?: boolean; alert?: boolean }) {
  const { t: tr } = useLocalization();
  return (
    <div className={cx(wide && "col-span-2")}>
      <dt className="text-[12px] text-ink-faint"><Copy>{k}</Copy></dt>
      <dd className={cx("font-medium", !v && "text-ink-faint", alert && "text-rose-700")}><Copy>{v || tr("Not given")}</Copy></dd>
    </div>
  );
}

function EpisodeBlock({
  ep,
  cases,
  encounters,
  requests,
  onStatus,
  onCaseStatus,
}: {
  ep: Episode;
  cases: Case[];
  encounters: Encounter[];
  requests: AdmissionRequest[];
  onStatus: (s: Episode["status"]) => void;
  onCaseStatus: (c: Case, s: Case["status"]) => void;
}) {
  const { department } = useMaster();
  const { fmtDate } = useMedbandFormat();
  const { t: tr } = useLocalization();
  const closed = ep.status === "Closed";
  return (
    <div className={cx("rounded-xl border", closed ? "border-line-soft bg-canvas/40" : "border-line")}>
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <FolderHeart className={cx("size-4", closed ? "text-ink-faint" : "text-scrub-600")} />
        <span className="text-[14.5px] font-semibold">{ep.title}</span>
        <Badge tone={ep.status === "Active" ? "bg-emerald-50 text-emerald-700" : ep.status === "On hold" ? "bg-amber-50 text-amber-800" : "bg-canvas text-ink-soft"}><LocalizedText message={ep.status ?? ""} /></Badge>
        <span className="text-[12.5px] text-ink-faint">
          <LocalizedText message={"{value0}, {value1}, {value2}, since {value3}"} values={{ value0: (ep.code) ?? "", value1: tr(ep.kind ?? ""), value2: (department(ep.departmentId)?.name) ?? "", value3: (fmtDate(ep.startDate)) ?? "" }} />
        </span>
        <div className="ml-auto flex gap-1">
          {ep.status === "Active" && (
            <Button size="sm" variant="ghost" onClick={() => onStatus("On hold")}>
              <Pause className="size-3.5" /> {" "}<LocalizedText message="Hold" /></Button>
          )}
          {ep.status !== "Active" && (
            <Button size="sm" variant="ghost" onClick={() => onStatus("Active")}>
              <Play className="size-3.5" /> {" "}<LocalizedText message="Reopen" /></Button>
          )}
          {!closed && (
            <Button size="sm" variant="ghost" onClick={() => onStatus("Closed")}>
              <Lock className="size-3.5" /> {" "}<LocalizedText message="Close" /></Button>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-2 border-t border-line-soft p-2">
        {cases.length === 0 && <p className="px-2 py-2 text-[13px] text-ink-faint"><LocalizedText message="No cases in this episode yet." /></p>}
        {cases.map((c) => (
          <CaseBlock
            key={c.id}
            c={c}
            encounters={encounters.filter((e) => e.caseId === c.id)}
            requests={requests.filter((r) => r.caseId === c.id)}
            episodeClosed={closed}
            onStatus={(s) => onCaseStatus(c, s)}
          />
        ))}
      </div>
    </div>
  );
}

const REQ_TONE: Record<AdmissionRequest["status"], string> = {
  Pending: "bg-amber-50 text-amber-800",
  Ready: "bg-emerald-50 text-emerald-700",
  Admitted: "bg-violet-50 text-violet-800",
  Cancelled: "bg-canvas text-ink-faint",
};

function CaseBlock({
  c,
  encounters,
  requests,
  episodeClosed,
  onStatus,
}: {
  c: Case;
  encounters: Encounter[];
  requests: AdmissionRequest[];
  episodeClosed: boolean;
  onStatus: (s: Case["status"]) => void;
}) {
  const { t: tr } = useLocalization();
  const open = c.status === "Open";
  // Follow-ups are nested under the visit they follow.
  const roots = encounters.filter((e) => !e.parentEncounterId || !encounters.some((x) => x.id === e.parentEncounterId));
  const children = (id: string) => encounters.filter((e) => e.parentEncounterId === id).sort((a, b) => a.start.localeCompare(b.start));
  const openRequest = requests.find((r) => r.status === "Pending" || r.status === "Ready");
  return (
    <div className={cx("rounded-lg", open ? "bg-paper ring-1 ring-line-soft" : "bg-canvas/50")}>
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
        <Stethoscope className={cx("size-4", open ? "text-scrub-600" : "text-ink-faint")} />
        <span className="text-[13.5px] font-semibold">{c.title}</span>
        <span className="text-[12px] text-ink-faint">{c.code}</span>
        {!open && <Badge tone="bg-canvas text-ink-soft"><LocalizedText message="Closed" /></Badge>}
        {c.medicoLegal && <Badge tone="bg-rose-50 text-rose-700"><Siren className="size-3" /> {" "}<LocalizedText message={"Medico-legal {value0}"} values={{ value0: (c.mlcNumber) ?? "" }} /></Badge>}
        <div className="ml-auto flex flex-wrap gap-1">
          {open && !episodeClosed && (
            <>
              <LinkButton size="sm" variant="ghost" href={medbandPaths.encounterNew({ patientId: c.patientId, case: c.id, department: c.departmentId })}>
                <CalendarPlus className="size-3.5" /> {" "}<LocalizedText message="Add visit" /></LinkButton>
              {!openRequest && (
                <LinkButton size="sm" variant="ghost" href={medbandPaths.admissionNew({ patientId: c.patientId, case: c.id })}>
                  <BedDouble className="size-3.5" /> {" "}<LocalizedText message="Request admission" /></LinkButton>
              )}
            </>
          )}
          {!episodeClosed && (
            <Button size="sm" variant="ghost" onClick={() => onStatus(open ? "Closed" : "Open")}>
              {open ? tr("Close case") : tr("Reopen case")}
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-1 px-3 pb-2">
        {c.complaints.map((x) => (
          <span key={x.code + x.label} className="rounded-full bg-scrub-50 px-2 py-0.5 text-[12px] font-medium text-scrub-800">
            <LocalizedText message={x.label ?? ""} />
            {x.duration ? <span className="text-scrub-600">, {x.duration} <LocalizedText message={x.unit ?? ""} /></span> : null}
          </span>
        ))}
        {c.provisionalDiagnosis && <span className="px-1 text-[12px] text-ink-soft"><LocalizedText message={"Working diagnosis: {value0}"} values={{ value0: (c.provisionalDiagnosis) ?? "" }} /></span>}
      </div>
      {requests.length > 0 && (
        <div className="mx-3 mb-2 flex flex-col gap-1">
          {requests.map((r) => (
            <Link key={r.id} href={medbandPaths.admissions()} className="flex flex-wrap items-center gap-2 rounded-md bg-violet-50/60 px-2.5 py-1.5 text-[12.5px] hover:bg-violet-50">
              <BedDouble className="size-3.5 text-violet-700" />
              <span className="font-semibold">{r.code}</span>
              <span className="text-ink-soft">{r.reason}</span>
              <Badge tone={REQ_TONE[r.status]}><LocalizedText message={r.status ?? ""} /></Badge>
            </Link>
          ))}
        </div>
      )}
      <div className="border-t border-line-soft px-1 py-1">
        {encounters.length === 0 && <p className="px-2 py-2 text-[13px] text-ink-faint"><LocalizedText message="No visits yet." /></p>}
        {roots
          .sort((a, b) => b.start.localeCompare(a.start))
          .map((e) => (
            <div key={e.id}>
              <EncounterRow e={e} />
              {children(e.id).length > 0 && (
                <div className="ml-6 border-l-2 border-amber-300 pl-2">
                  {children(e.id).map((ch) => (
                    <EncounterRow key={ch.id} e={ch} />
                  ))}
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}

function EncounterRow({ e, showEpisode }: { e: Encounter; showEpisode?: boolean }) {
  const { department, practitioner, ward } = useMaster();
  const { fmtDateTime } = useMedbandFormat();
  const { t: tr } = useLocalization();
  const store = useStore();
  const detail =
    e.chiefComplaint ||
    e.admissionReason ||
    e.services?.join(", ") ||
    (e.packageId ? tr("Health check package") : "") ||
    (e.referringFacility ? tr("Referred by {value0}", { value0: e.referringFacility }) : "") ||
    tr("Visit");
  const extra = [
    tr(START_TYPES[e.startType].label),
    department(e.departmentId)?.name,
    practitioner(e.practitionerId)?.name,
    e.bed ? `${ward(e.wardId)?.name} ${e.bed}` : "",
    e.triage ? tr("Triage {value0}", { value0: tr(e.triage) }) : "",
    tr(e.billingMode),
  ].filter(Boolean);
  return (
    <div className="flex items-start gap-3 rounded-lg px-2 py-2.5 hover:bg-canvas">
      <TypeTag type={e.type} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-semibold">
          {detail}
          {e.followUpDerived && <Badge className="ml-2 align-middle" tone="bg-band/30 text-amber-900"><LocalizedText message="Auto follow-up" /></Badge>}
          {e.followUpChargeable && <Badge className="ml-1 align-middle" tone="bg-canvas text-ink-soft"><LocalizedText message="Paid" /></Badge>}
        </p>
        <p className="truncate text-[12.5px] text-ink-soft">{extra.join(", ")}</p>
        {showEpisode && (
          <p className="truncate text-[12px] text-ink-faint">
            <LocalizedText message={"{value0}, case {value1}"} values={{ value0: (store.episodeById(e.episodeId)?.title) ?? "", value1: (store.caseById(e.caseId)?.code) ?? "" }} />
          </p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[12.5px] font-medium">{e.code}</p>
        <p className="text-[12px] text-ink-faint">{fmtDateTime(e.start)}</p>
      </div>
      <StatusPill status={e.status} />
    </div>
  );
}

