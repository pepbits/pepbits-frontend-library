"use client";

import { Siren } from "lucide-react";
import { useState } from "react";
import { useStore } from "../../lib/store";
import type { Gender, Patient } from "../../lib/types";
import { toDateInput } from "../../lib/utils";
import { Checkbox, Field, Input, Segmented } from "../ui/form";
import { Modal, useErrorToast } from "../ui/overlay";
import { Button } from "../ui/primitives";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";

/**
 * Emergency counter fast path. Registers a patient with the minimum needed to start
 * care; an unidentified patient gets a temporary name that is corrected later on the record.
 */
export function QuickRegister({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (p: Patient) => void }) {
  const { t: tr } = useLocalization();
  const store = useStore();
  const fail = useErrorToast();
  const [unknown, setUnknown] = useState(false);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [gender, setGender] = useState<Gender>("Male");
  const [age, setAge] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);

  const ageNum = Number(age);
  const ageOk = age !== "" && ageNum >= 0 && ageNum <= 120;
  const nameOk = unknown || (first.trim() && last.trim());

  const save = async () => {
    setTried(true);
    if (!ageOk || !nameOk) return;
    setBusy(true);
    try {
      const dob = new Date();
      dob.setFullYear(dob.getFullYear() - ageNum, 0, 1);
      const tag = Math.random().toString(36).slice(2, 6).toUpperCase();
      const p = await store.registerPatient({
        firstName: unknown ? "Unknown" : first.trim(),
        lastName: unknown ? `${gender} ${tag}` : last.trim(),
        gender: unknown && gender === "Other" ? "Unknown" : gender,
        dob: toDateInput(dob),
        phone: phone.trim(),
        unidentified: unknown,
        coverages: [],
      });
      onDone(p);
      setFirst(""), setLast(""), setAge(""), setPhone(""), setUnknown(false), setTried(false);
    } catch (e) {
      fail(e, "Could not register");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Emergency quick registration"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}><LocalizedText message="Cancel" /></Button>
          <Button onClick={() => void save()} disabled={busy}>{busy ? tr("Registering") : tr("Register and continue")}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-[13px] text-rose-900">
          <Siren className="mt-0.5 size-4 shrink-0" />
          <LocalizedText message="Start care first. Complete the identity, contact and insurance details on the patient record once the patient is stable." /></p>
        <Checkbox checked={unknown} onChange={setUnknown} label="Identity not known" sub="Registers as Unknown with a temporary tag" />
        {!unknown && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="First name" required error={tried && !first.trim() ? tr("Required") : undefined}>
              <Input autoFocus value={first} onChange={(e) => setFirst(e.target.value)} />
            </Field>
            <Field label="Last name" required error={tried && !last.trim() ? tr("Required") : undefined}>
              <Input value={last} onChange={(e) => setLast(e.target.value)} />
            </Field>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-[auto_8rem_1fr]">
          <Field label="Sex">
            <Segmented<Gender>
              value={gender}
              onChange={setGender}
              options={[
                { value: "Male", label: "Male" },
                { value: "Female", label: "Female" },
                { value: "Other", label: "Other" },
              ]}
            />
          </Field>
          <Field label="Age (approx.)" required error={tried && !ageOk ? tr("0 to 120") : undefined}>
            <Input type="number" min={0} max={120} value={age} onChange={(e) => setAge(e.target.value)} />
          </Field>
          <Field label="Phone (if available)">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Patient or companion" />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
