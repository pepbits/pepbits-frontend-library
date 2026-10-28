"use client";
import React, { useEffect, useId, useRef, useState } from "react";
import { Button, Input, Select, Textarea } from "@pepbits/ui";
import { Drawer } from "@pepbits/components";
import { useLocalization } from "@pepbits/i18n/react";
import { useFormatters } from "@pepbits/patterns/screen-host";
import { useClinicalActor } from "../context/clinical-context";
import { useConsultHost, useConsultPort } from "../context/consult-host";
import { problemsOf } from "../context/port";
import { ConsultSection } from "../layout/ConsultSection";
import { ProblemNotice } from "../layout/panel";
import { FacilityPicker } from "../reference/FacilityPicker";
import {
  admissionComplete,
  emergencyComplete,
  type AdmissionRequest,
  type EmergencyTransfer,
} from "../models/consult-note";
import type { ConsultSectionProps } from "../models/consult-workflow";
import { departmentsFor } from "../models/consult-reference";
import { localOrderTime, OrderLoadProblems } from "../orders/OrderPriority";
import { ReferralEditor, usePlanLookups } from "./ReferralSection";
const options = (entries: readonly (readonly [string, string])[]) => [
  { value: "", label: "Choose" },
  ...entries.map(([value, label]) => ({ value, label })),
];
const NEEDS = [
  ["oxygen", "Oxygen"],
  ["cardiac-monitoring", "Cardiac monitoring"],
  ["fall-risk", "Fall risk"],
  ["bariatric", "Bariatric"],
  ["mobility-assistance", "Mobility help"],
  ["interpreter", "Interpreter"],
  ["dietary", "Special diet"],
] as const;
export function AdmissionEditor({
  draft,
  onChange,
  readOnly,
  onClose,
}: Pick<ConsultSectionProps, "draft" | "onChange" | "readOnly"> & {
  onClose: () => void;
}) {
  const lookup = usePlanLookups(),
    { t } = useLocalization();
  const [a, setA] = useState<AdmissionRequest>(() =>
    structuredClone(
      draft.admission ?? {
        timing: "now",
        reason: draft.diagnoses.find((x) => x.primary)?.display ?? "",
        isolation: "none",
        level: "ward",
        expectedStayDays: null,
        needs: [],
      }
    )
  );
  const set = (patch: Partial<AdmissionRequest>) => {
    if (!readOnly) setA((old) => ({ ...old, ...patch }));
  };
  const inpatient = departmentsFor(lookup.data?.services ?? null, "inpatient"),
    now = a.timing === "now";
  const complete =
    !lookup.loading &&
    !lookup.problems.length &&
    admissionComplete(a, inpatient.length);
  const save = () => {
    if (readOnly || !complete) return;
    onChange((n) => {
      n.disposition = "admit";
      n.admission = a;
      n.emergency = null;
      n.followUp = null;
      n.followUpNone = false;
    });
    onClose();
  };
  return (
    <Drawer
      open
      title={t("Admission request")}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t("Cancel")}</Button>
          <Button disabled={readOnly || !complete} onClick={save}>
            {t("Save admission request")}
          </Button>
        </>
      }
    >
      <OrderLoadProblems {...lookup} />
      <div className="grid gap-3">
        <Select
          label="When"
          disabled={readOnly}
          value={a.timing ?? ""}
          options={options([
            ["now", "Admit now"],
            ["planned", "Planned admission"],
          ])}
          onChange={(e) =>
            set({
              timing: (e.target.value as AdmissionRequest["timing"]) || null,
            })
          }
        />
        {now ? (
          <Select
            label="Urgency"
            required
            disabled={readOnly}
            value={a.urgency ?? ""}
            options={options([
              ["immediate", "Immediate"],
              ["within-4h", "Within 4 hours"],
            ])}
            onChange={(e) =>
              set({
                urgency:
                  (e.target.value as AdmissionRequest["urgency"]) || undefined,
              })
            }
          />
        ) : (
          <Select
            label="Priority"
            required
            disabled={readOnly}
            value={a.priority ?? ""}
            options={options([
              ["routine", "Routine"],
              ["urgent", "Urgent"],
              ["asap", "As soon as possible"],
            ])}
            onChange={(e) =>
              set({
                priority:
                  (e.target.value as AdmissionRequest["priority"]) || undefined,
              })
            }
          />
        )}
        <Select
          label="Specialty"
          required
          disabled={readOnly}
          value={a.specialty ?? ""}
          options={options((lookup.data?.specialties ?? []).map((s) => [s, s]))}
          onChange={(e) => set({ specialty: e.target.value })}
        />
        {now ? (
          inpatient.length > 0 && (
            <Select
              label="Admitting department"
              required
              disabled={readOnly}
              value={a.department ?? ""}
              options={options(inpatient.map((d) => [d.name, d.name]))}
              onChange={(e) => set({ department: e.target.value })}
            />
          )
        ) : (
          <>
            <Select
              label="Admission type"
              required
              disabled={readOnly}
              value={a.admissionType ?? ""}
              options={options([
                ["elective", "Elective (planned) medical"],
                ["surgical", "Planned procedure or surgery"],
                ["maternity", "Maternity"],
                ["respite", "Respite"],
              ])}
              onChange={(e) => set({ admissionType: e.target.value })}
            />
            <Input
              label="Admit by"
              required
              type="date"
              min={new Date().toISOString().slice(0, 10)}
              disabled={readOnly}
              value={a.targetDate ?? ""}
              onChange={(e) => set({ targetDate: e.target.value })}
            />
          </>
        )}
        <Select
          label={now ? "Consultant" : "Admitting consultant"}
          required={!now}
          disabled={readOnly}
          value={a.clinicianId ?? ""}
          options={[
            { value: "", label: now ? "On-call consultant" : "Choose" },
            ...(lookup.data?.clinicians ?? [])
              .filter((c) => c.role === "doctor")
              .map((c) => ({ value: c.id, label: c.name })),
          ]}
          onChange={(e) => set({ clinicianId: e.target.value })}
        />
        <Input
          label="Expected stay (days)"
          required
          type="number"
          min={0}
          max={365}
          disabled={readOnly}
          value={a.expectedStayDays ?? ""}
          onChange={(e) =>
            set({
              expectedStayDays:
                e.target.value === ""
                  ? null
                  : Math.trunc(Number(e.target.value)),
            })
          }
        />
        {now && (
          <Select
            label="Level of care"
            required
            disabled={readOnly}
            value={a.level ?? ""}
            options={options([
              ["ward", "Ward"],
              ["hdu", "High dependency"],
              ["icu", "ICU"],
              ["isolation-room", "Isolation room"],
            ])}
            onChange={(e) =>
              set({
                level:
                  (e.target.value as AdmissionRequest["level"]) || undefined,
              })
            }
          />
        )}
        <Select
          label="Isolation"
          disabled={readOnly}
          value={a.isolation ?? "none"}
          options={options([
            ["none", "None"],
            ["contact", "Contact"],
            ["droplet", "Droplet"],
            ["airborne", "Airborne"],
          ])}
          onChange={(e) =>
            set({
              isolation:
                (e.target.value as AdmissionRequest["isolation"]) || undefined,
            })
          }
        />
        <Textarea
          label="Reason for admission"
          required
          rows={2}
          maxLength={2000}
          disabled={readOnly}
          value={a.reason ?? ""}
          onChange={(e) => set({ reason: e.target.value })}
        />
        {!now && (
          <Textarea
            label="Pre-admission requirements"
            required
            rows={2}
            maxLength={2000}
            disabled={readOnly}
            value={a.requirements ?? ""}
            onChange={(e) => set({ requirements: e.target.value })}
          />
        )}
        <div role="group" aria-label={t("Needs")}>
          {NEEDS.map(([code, label]) => (
            <Button
              key={code}
              disabled={readOnly}
              aria-pressed={a.needs?.includes(code) ?? false}
              onClick={() =>
                set({
                  needs: a.needs?.includes(code)
                    ? a.needs.filter((x) => x !== code)
                    : [...(a.needs ?? []), code],
                })
              }
            >
              {t(label)}
            </Button>
          ))}
        </div>
        <p>
          {t(
            now
              ? "When you sign, the patient goes to the bed board with this request; an immediate admission also alerts the bed manager."
              : "When you sign, the admission joins Planned admissions for insurer authorisation, scheduling and pre-assessment."
          )}
        </p>
      </div>
    </Drawer>
  );
}
export function EmergencyEditor({
  draft,
  onChange,
  readOnly,
  onClose,
}: Pick<ConsultSectionProps, "draft" | "onChange" | "readOnly"> & {
  onClose: () => void;
}) {
  const lookup = usePlanLookups(),
    { t } = useLocalization();
  const [value, setValue] = useState<EmergencyTransfer>(() => ({
    ...(draft.emergency ?? { destination: "internal", transport: null }),
  }));
  const departments = departmentsFor(
    lookup.data?.services ?? null,
    "emergency"
  ).map((d) => d.name);
  const ours = departments.length ? departments : ["Emergency department"];
  const only = ours.length === 1 ? ours[0] : undefined;
  useEffect(() => {
    if (
      !readOnly &&
      !lookup.loading &&
      value.destination === "internal" &&
      !value.department &&
      only
    )
      setValue((old) => ({ ...old, department: only }));
  }, [readOnly, lookup.loading, value.destination, value.department, only]);
  const set = (patch: Partial<EmergencyTransfer>) => {
    if (!readOnly) setValue((old) => ({ ...old, ...patch }));
  };
  const complete =
    !lookup.loading && !lookup.problems.length && emergencyComplete(value);
  return (
    <Drawer
      open
      title={t("Send to emergency")}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t("Cancel")}</Button>
          <Button
            disabled={readOnly || !complete}
            onClick={() => {
              if (readOnly || !complete) return;
              onChange((n) => {
                n.disposition = "refer-er";
                n.emergency = value;
                n.admission = null;
                n.followUp = null;
                n.followUpNone = false;
              });
              onClose();
            }}
          >
            {t("Save emergency transfer")}
          </Button>
        </>
      }
    >
      <OrderLoadProblems {...lookup} />
      <Select
        label="Where"
        disabled={readOnly}
        value={value.destination ?? ""}
        options={options([
          ["internal", "Our emergency department"],
          ["external", "Another facility"],
        ])}
        onChange={(e) =>
          set({
            destination: (e.target.value as "internal" | "external") || null,
            department: e.target.value === "internal" ? only : undefined,
            facility: undefined,
          })
        }
      />
      {value.destination === "internal" ? (
        <Select
          label="Emergency department"
          required
          disabled={readOnly}
          value={value.department ?? ""}
          options={options(ours.map((s) => [s, s]))}
          onChange={(e) => set({ department: e.target.value })}
        />
      ) : (
        value.destination === "external" && (
          <FacilityPicker
            label="Facility"
            emergencyOnly
            required
            disabled={readOnly}
            value={value.facility ?? ""}
            onChange={(facility) => set({ facility })}
          />
        )
      )}
      <Select
        label="Transport"
        required
        disabled={readOnly}
        value={value.transport ?? ""}
        options={options([
          ["walk-in", "Walk-in"],
          ["wheelchair", "Wheelchair"],
          ["stretcher", "Stretcher"],
          ["ambulance", "Ambulance"],
        ])}
        onChange={(e) =>
          set({
            transport:
              (e.target.value as EmergencyTransfer["transport"]) || null,
          })
        }
      />
      <Textarea
        label="Handover"
        disabled={readOnly}
        value={value.handover ?? ""}
        maxLength={2000}
        onChange={(e) => set({ handover: e.target.value })}
      />
    </Drawer>
  );
}
export function dischargeTimeProblem(value: string, arrivedAt?: string) {
  const time = Date.parse(value);
  return !Number.isFinite(time)
    ? "Clinical discharge time is required."
    : time > Date.now() + 5 * 60000
    ? "Clinical discharge time can't be in the future."
    : arrivedAt && time < Date.parse(arrivedAt) - 60000
    ? "Clinical discharge time is before the visit started."
    : "";
}
function SignedDischarge({
  detail,
  onRecordsChanged,
}: Pick<ConsultSectionProps, "detail" | "onRecordsChanged">) {
  const port = useConsultPort(),
    { can } = useClinicalActor(),
    { t } = useLocalization(),
    format = useFormatters();
  const [enc, setEnc] = useState(detail.encounter),
    [open, setOpen] = useState(false),
    [at, setAt] = useState(""),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [problems, setProblems] = useState<string[]>([]),
    writing = useRef(false);
  useEffect(() => setEnc(detail.encounter), [detail.encounter]);
  const save = async () => {
    if (
      !can("note.write") ||
      writing.current ||
      reason.trim().length < 5 ||
      !at ||
      dischargeTimeProblem(at, enc.arrivedAt) ||
      enc.version == null
    )
      return;
    writing.current = true;
    setBusy(true);
    setProblems([]);
    try {
      const next = await port.recordClinicalDischarge(enc.id, {
        at: new Date(at).toISOString(),
        reason,
        expectedVersion: enc.version,
      });
      setEnc({ ...enc, ...next });
      setOpen(false);
      await onRecordsChanged?.();
    } catch (error) {
      setProblems(problemsOf(error));
    } finally {
      writing.current = false;
      setBusy(false);
    }
  };
  return (
    <div>
      <p>
        {t("Clinically discharged at")}:{" "}
        {enc.clinicalDischargeAt &&
          format.dateTime(new Date(enc.clinicalDischargeAt))}
      </p>
      <ProblemNotice problems={problems} />
      {can("note.write") && (
        <Button
          disabled={busy}
          onClick={() => {
            setAt(localOrderTime(enc.clinicalDischargeAt));
            setReason("");
            setOpen(true);
          }}
        >
          {t("Correct discharge time")}
        </Button>
      )}
      {open && (
        <>
          <Input
            label="Correct time"
            type="datetime-local"
            disabled={busy}
            max={localOrderTime(new Date().toISOString())}
            value={at}
            onChange={(e) => setAt(e.target.value)}
          />
          <Textarea
            label="Reason"
            required
            maxLength={500}
            disabled={busy}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <ProblemNotice
            problems={[dischargeTimeProblem(at, enc.arrivedAt)].filter(Boolean)}
          />
          <Button disabled={busy} onClick={() => setOpen(false)}>
            {t("Cancel")}
          </Button>
          <Button
            disabled={
              busy ||
              !at ||
              reason.trim().length < 5 ||
              !!dischargeTimeProblem(at, enc.arrivedAt) ||
              enc.version == null
            }
            onClick={() => void save()}
          >
            {t("Save correction")}
          </Button>
        </>
      )}
      <ol>
        {enc.clinicalDischargeChanges?.map((change, i) => (
          <li key={i}>
            {format.dateTime(new Date(change.from))} →{" "}
            {format.dateTime(new Date(change.to))} · {change.byName} ·{" "}
            {format.dateTime(new Date(change.at))} · {change.reason}
          </li>
        ))}
      </ol>
    </div>
  );
}
export function DispositionSection(props: ConsultSectionProps) {
  const { draft, onChange, readOnly, detail } = props,
    host = useConsultHost(),
    { t } = useLocalization(),
    uid = useId();
  const [drawer, setDrawer] = useState<
    "admit" | "refer-er" | "refer-external" | null
  >(null);
  const update: typeof onChange = (fn) => {
    if (!readOnly) onChange(fn);
  };
  useEffect(() => {
    if (!readOnly && draft.disposition && !draft.dischargeAt)
      onChange((n) => {
        n.dischargeAt = new Date().toISOString();
      });
  }, [readOnly, draft.disposition, draft.dischargeAt, onChange]);
  const choose = (value: NonNullable<typeof draft.disposition>) => {
    if (readOnly) return;
    if (
      value === "admit" ||
      value === "refer-er" ||
      value === "refer-external"
    ) {
      setDrawer(value);
      return;
    }
    update((n) => {
      n.disposition = n.disposition === value ? null : value;
      if (n.disposition !== "follow-up") {
        n.followUp = null;
        n.followUpNone = false;
      }
      n.admission = null;
      n.emergency = null;
    });
  };
  return (
    <ConsultSection
      id={props.id ?? uid}
      stickyOffset={host.stickyOffset}
      title="Disposition"
    >
      <div role="group" aria-label={t("Disposition")}>
        {(
          [
            ["home", "Home"],
            ["follow-up", "Home with follow-up"],
            ["admit", "Admit…"],
            ["refer-er", "Send to emergency…"],
            ["refer-external", "External referral…"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            disabled={readOnly}
            aria-pressed={draft.disposition === value}
            onClick={() => choose(value)}
          >
            {t(label)}
          </Button>
        ))}
      </div>
      {draft.disposition === "admit" && (
        <p>
          {draft.admission?.specialty} · {draft.admission?.department} ·{" "}
          {t(draft.admission?.timing ?? "Details not given")} ·{" "}
          {draft.admission?.reason}
        </p>
      )}
      {draft.disposition === "refer-er" && (
        <p>
          {draft.emergency?.department ?? draft.emergency?.facility} ·{" "}
          {t(draft.emergency?.transport ?? "Details not given")} ·{" "}
          {draft.emergency?.handover}
        </p>
      )}
      {draft.disposition === "refer-external" && (
        <p>
          {draft.referral?.specialty} · {draft.referral?.organisation} ·{" "}
          {draft.referral?.question}
        </p>
      )}
      {draft.disposition &&
        (detail.note?.status === "final" &&
        detail.encounter.clinicalDischargeAt ? (
          <SignedDischarge key={detail.encounter.id} {...props} />
        ) : (
          <>
            <Input
              label={
                draft.disposition === "admit"
                  ? "Decision to admit at"
                  : ["refer-er", "refer-external"].includes(draft.disposition)
                  ? "Left our care at"
                  : "Clinically discharged at"
              }
              type="datetime-local"
              min={localOrderTime(detail.encounter.arrivedAt)}
              max={localOrderTime(new Date().toISOString())}
              disabled={readOnly}
              value={localOrderTime(draft.dischargeAt)}
              onChange={(e) =>
                update((n) => {
                  n.dischargeAt = e.target.value
                    ? new Date(e.target.value).toISOString()
                    : "";
                })
              }
            />
            <Button
              disabled={readOnly}
              onClick={() =>
                update((n) => {
                  n.dischargeAt = new Date().toISOString();
                })
              }
            >
              {t("Now")}
            </Button>
            <ProblemNotice
              problems={[
                dischargeTimeProblem(
                  draft.dischargeAt ?? "",
                  detail.encounter.arrivedAt
                ),
              ].filter(Boolean)}
            />
          </>
        ))}
      {drawer === "admit" && (
        <AdmissionEditor {...props} onClose={() => setDrawer(null)} />
      )}{" "}
      {drawer === "refer-er" && (
        <EmergencyEditor {...props} onClose={() => setDrawer(null)} />
      )}{" "}
      {drawer === "refer-external" && (
        <ReferralEditor {...props} external onClose={() => setDrawer(null)} />
      )}
    </ConsultSection>
  );
}
