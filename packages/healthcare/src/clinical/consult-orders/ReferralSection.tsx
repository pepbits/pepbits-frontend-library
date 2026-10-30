"use client";
import React, { useCallback, useId, useState } from "react";
import { Button, Input, Select, Textarea } from "@pepbits/ui";
import { Drawer } from "@pepbits/components";
import { useLocalization } from "@pepbits/i18n/react";
import { useConsultHost, useConsultPort } from "../context/consult-host";
import { ConsultSection } from "../layout/ConsultSection";
import { FacilityPicker } from "../reference/FacilityPicker";
import { referralComplete, type NoteContent } from "../models/consult-note";
import type { ConsultSectionProps } from "../models/consult-workflow";
import { OrderLoadProblems, useOrderResource } from "../orders/OrderPriority";
import { EducationSection } from "./EducationSection";
export function usePlanLookups() {
  const port = useConsultPort();
  return useOrderResource(
    useCallback(
      async (signal: AbortSignal) => {
        const [specialties, clinicians, services] = await Promise.all([
          port.listSpecialties(signal),
          port.listClinicians(signal),
          port.loadServices(signal),
        ]);
        return { specialties, clinicians, services };
      },
      [port]
    )
  );
}
export function ReferralEditor({
  draft,
  onChange,
  readOnly,
  external: startExternal,
  onClose,
}: Pick<ConsultSectionProps, "draft" | "onChange" | "readOnly"> & {
  external?: boolean;
  onClose: () => void;
}) {
  const lookups = usePlanLookups(),
    { t } = useLocalization();
  const [r, setR] = useState<NonNullable<NoteContent["referral"]>>(() => ({
    ...(draft.referral ?? { specialty: "", urgency: "routine", question: "" }),
  }));
  const [external, setExternal] = useState(
    startExternal ?? draft.disposition === "refer-external"
  );
  const set = (patch: Partial<typeof r>) => {
    if (!readOnly) setR((old) => ({ ...old, ...patch }));
  };
  const save = () => {
    if (readOnly || !referralComplete(r, external)) return;
    onChange((n) => {
      n.referral = external
        ? { ...r, doctorId: undefined }
        : { ...r, organisation: undefined, doctorName: undefined };
      if (external) {
        n.disposition = "refer-external";
        n.admission = null;
        n.emergency = null;
        n.followUp = null;
        n.followUpNone = false;
      } else if (n.disposition === "refer-external") n.disposition = null;
    });
    onClose();
  };
  return (
    <Drawer
      open
      title={t("Referral")}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t("Cancel")}</Button>
          <Button
            disabled={readOnly || !referralComplete(r, external)}
            onClick={save}
          >
            {t("Save referral")}
          </Button>
        </>
      }
    >
      <OrderLoadProblems {...lookups} />
      <div className="grid gap-3">
        <Select
          label="Specialty"
          required
          disabled={readOnly}
          value={r.specialty}
          options={[
            { value: "", label: "Choose" },
            ...(lookups.data?.specialties ?? []).map((s) => ({
              value: s,
              label: s,
            })),
          ]}
          onChange={(e) => set({ specialty: e.target.value })}
        />
        <Select
          label="Urgency"
          disabled={readOnly}
          value={r.urgency}
          options={[
            { value: "routine", label: "Routine" },
            { value: "urgent", label: "Urgent" },
          ]}
          onChange={(e) =>
            set({ urgency: e.target.value as "routine" | "urgent" })
          }
        />
        <Select
          label="Where"
          disabled={readOnly}
          value={external ? "external" : "internal"}
          options={[
            { value: "internal", label: "Within our organisation" },
            { value: "external", label: "Another organisation" },
          ]}
          onChange={(e) => {
            if (!readOnly) setExternal(e.target.value === "external");
          }}
        />
        {external ? (
          <>
            <FacilityPicker
              label="Organisation"
              required
              disabled={readOnly}
              value={r.organisation ?? ""}
              onChange={(organisation) => set({ organisation })}
            />
            <Input
              label="Doctor (optional)"
              disabled={readOnly}
              maxLength={120}
              value={r.doctorName ?? ""}
              onChange={(e) => set({ doctorName: e.target.value })}
            />
          </>
        ) : (
          <Select
            label="Doctor"
            disabled={readOnly}
            value={r.doctorId ?? ""}
            options={[
              { value: "", label: "Any available specialist" },
              ...(lookups.data?.clinicians ?? []).map((c) => ({
                value: c.id,
                label: c.name,
              })),
            ]}
            onChange={(e) => set({ doctorId: e.target.value || undefined })}
          />
        )}
        <Textarea
          label="Clinical question"
          required
          disabled={readOnly}
          rows={3}
          value={r.question}
          onChange={(e) => set({ question: e.target.value })}
        />
        {draft.referral && (
          <Button
            disabled={readOnly}
            onClick={() => {
              if (readOnly) return;
              onChange((n) => {
                n.referral = null;
                if (n.disposition === "refer-external") n.disposition = null;
              });
              onClose();
            }}
          >
            {t("Remove referral")}
          </Button>
        )}
      </div>
    </Drawer>
  );
}
/** Source section groups referral with patient education. EducationSection is also exported for host layouts. */
export function ReferralSection(props: ConsultSectionProps) {
  const { draft, readOnly } = props,
    { t } = useLocalization(),
    host = useConsultHost(),
    uid = useId();
  const [editing, setEditing] = useState(false);
  return (
    <ConsultSection
      id={props.id ?? uid}
      stickyOffset={host.stickyOffset}
      title="Patient education"
    >
      <h3>{t("Referral")}</h3>
      {draft.referral ? (
        <p>
          {draft.referral.specialty} · {t(draft.referral.urgency)} ·{" "}
          {draft.referral.organisation ?? t("Our organisation")} ·{" "}
          {draft.referral.question}
        </p>
      ) : (
        <p>{t("No referral")}</p>
      )}
      <Button disabled={readOnly} onClick={() => setEditing(true)}>
        {t(draft.referral ? "Edit referral" : "Add referral")}
      </Button>
      <EducationSection {...props} id={undefined} />
      {editing && (
        <ReferralEditor {...props} onClose={() => setEditing(false)} />
      )}
    </ConsultSection>
  );
}
