"use client";
import {LocalizedText} from "@pepbits/ops-ui";
import { SourceInput, SourceSelect, SourceButton } from "@pepbits/ops-ui";

import { useEffect, useState, type ReactNode } from "react";
import { useStaff } from "./../lib/masters";
import { ROLE_LABEL } from "./../lib/format";
import { useUser } from "./Shell";
import { Button, ErrorNote, Field, Modal, useAction } from "./ui";
import { IconLock } from "./icons";

export type SignPayload = { pin: string; witnessId?: number; witnessPin?: string };

/**
 * Re-authenticates the signer with their PIN and, when needed, a second person as witness.
 * The server verifies both PINs and stores a SHA-256 signature hash.
 */
export function SignDialog({
  open, onClose, title, action, witness = "none", witnessRoles, children, onSign, confirmLabel = "Sign", valid = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  action: string;
  witness?: "none" | "optional" | "required";
  witnessRoles?: string[];
  children?: ReactNode;
  onSign: (p: SignPayload) => Promise<unknown>;
  confirmLabel?: string;
  valid?: boolean;
}) {
  const user = useUser();
  const staff = useStaff();
  const [pin, setPin] = useState("");
  const [witnessId, setWitnessId] = useState("");
  const [witnessPin, setWitnessPin] = useState("");
  const { run, busy, error, setError } = useAction();

  useEffect(() => {
    if (open) {
      setPin("");
      setWitnessId("");
      setWitnessPin("");
      setError(null);
    }
  }, [open, setError]);

  const candidates = staff.filter((s) => s.id !== user.id && s.active && (!witnessRoles || witnessRoles.includes(s.role)));
  const needWitness = witness === "required" || (witness === "optional" && witnessId);
  const ready = valid && pin.length >= 4 && (!needWitness || (witnessId && witnessPin.length >= 4));

  const submit = async () => {
    const r = await run(() => onSign({ pin, witnessId: witnessId ? Number(witnessId) : undefined, witnessPin: witnessPin || undefined }));
    if (r !== undefined) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}><LocalizedText message={"Cancel"}/></Button>
          <Button variant="primary" onClick={submit} busy={busy} disabled={!ready}>
            <IconLock size={15} /> {confirmLabel}
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) void submit();
        }}
      >
        {children}
        <div className="rounded-[8px] border border-line bg-steel/60 p-3">
          <p className="mb-2 text-[13px] text-muted">
            <LocalizedText message={"You are signing as"}/>{" "}<span className="font-medium text-ink">{user.name}</span> ({ROLE_LABEL[user.role]}<LocalizedText message={") to"}/>{" "}{action}.
          </p>
          <Field label="Your PIN">
            <SourceInput className="input" type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value)} maxLength={6} />
          </Field>
        </div>
        {witness !== "none" && (
          <div className="rounded-[8px] border border-line p-3">
            <p className="mb-2 text-[13px] text-muted">{witness === "required" ? "A witness must confirm with their own PIN." : "Add a witness if your policy requires one."}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={witness === "required" ? "Witness" : "Witness (optional)"}>
                <SourceSelect className="input" value={witnessId} onChange={(e) => setWitnessId(e.target.value)}>
                  <option value=""><LocalizedText message={"Choose a person"}/></option>
                  {candidates.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {ROLE_LABEL[s.role]}
                    </option>
                  ))}
                </SourceSelect>
              </Field>
              <Field label="Witness PIN">
                <SourceInput className="input" type="password" inputMode="numeric" autoComplete="off" value={witnessPin} onChange={(e) => setWitnessPin(e.target.value)} maxLength={6} disabled={!witnessId} />
              </Field>
            </div>
          </div>
        )}
        <ErrorNote error={error} />
        <SourceButton type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
