"use client";

import type { ReactNode } from "react";
import { Pencil } from "lucide-react";
import { CheckRow } from "@/components/ui/Choice";
import { BRAND } from "@/lib/brand";
import {
  ADMIN_ROLES,
  EMRAM_TARGETS,
  INTEGRATIONS,
  MODULE_GROUPS,
  STANDARD_GROUPS,
  careSetting,
  country,
  facilityType,
  regionLabel,
} from "@/lib/catalog";
import type { Consents, StepId } from "@/lib/registration";
import { Section } from "../Section";
import type { StepProps } from "../types";

export function StepReview({ data, errors, setData, onJump }: StepProps) {
  const o = data.org;
  const w = data.workspace;
  const c = country(o.country);
  const standards = STANDARD_GROUPS.flatMap((g) => g.items).filter((i) => data.standards.includes(i.id));
  const integrations = INTEGRATIONS.filter((i) => data.integrations.includes(i.id));
  const setConsent = (k: keyof Consents, v: boolean) => setData((d) => ({ ...d, consents: { ...d.consents, [k]: v } }));

  return (
    <div className="space-y-10">
      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        <Card title="Organization" step="organization" onJump={onJump}>
          <Row label="Setup">{data.structure === "network" ? "Multi-facility network" : "Single facility"}</Row>
          <Row label="Operates">{data.facilityTypes.map((t) => facilityType(t)?.label).join(", ")}</Row>
        </Card>

        <Card title="Details" step="details" onJump={onJump}>
          <Row label="Legal name">{o.legalName}</Row>
          {o.displayName && <Row label="Display name">{o.displayName}</Row>}
          <Row label="License">{o.licenseNumber}</Row>
          <Row label="Location">{[o.city, c?.name].filter(Boolean).join(", ")}</Row>
          <Row label="Phone">
            {c?.dial} {o.phone}
          </Row>
          <Row label="Regional">
            {o.timezone.replace(/_/g, " ")}, {o.currency}
          </Row>
          {o.beds && data.structure !== "network" && <Row label="Beds">{o.beds}</Row>}
        </Card>

        {data.structure === "network" && (
          <Card title={`Facilities (${data.facilities.length})`} step="facilities" onJump={onJump}>
            <ul className="space-y-1.5">
              {data.facilities.map((f) => (
                <li key={f.id} className="flex justify-between gap-3 text-sm">
                  <span className="truncate font-medium text-ink-900">{f.name}</span>
                  <span className="shrink-0 text-ink-500">
                    {facilityType(f.type)?.label}, {f.city}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card title="Clinical scope" step="scope" onJump={onJump}>
          <Row label="Care settings">
            {data.careSettings.length ? data.careSettings.map((id) => careSetting(id)?.label).join(", ") : "None"}
          </Row>
          <Row label="Specialties">
            {data.specialties.length === 0
              ? "None yet"
              : data.specialties.length <= 4
                ? data.specialties.join(", ")
                : `${data.specialties.slice(0, 3).join(", ")} and ${data.specialties.length - 3} more`}
          </Row>
        </Card>

        <Card title={`Modules (${data.modules.length})`} step="modules" onJump={onJump}>
          {MODULE_GROUPS.map((g) => {
            const n = g.modules.filter((m) => data.modules.includes(m.id)).length;
            return n ? (
              <Row key={g.id} label={g.label}>
                {n} of {g.modules.length}
              </Row>
            ) : null;
          })}
          <Row label="Standards">{standards.map((s) => s.label).join(", ") || "None"}</Row>
          <Row label="Integrations">{integrations.map((i) => i.label).join(", ") || "None"}</Row>
          {data.emramTarget !== "none" && (
            <Row label="EMRAM target">{EMRAM_TARGETS.find((t) => t.value === data.emramTarget)?.label}</Row>
          )}
        </Card>

        <Card title="Workspace and administrator" step="workspace" onJump={onJump}>
          <Row label="Address">
            <span className="font-semibold text-scrub-800">
              {w.slug}.{BRAND.domain}
            </span>
          </Row>
          <Row label="Data stored in">{regionLabel(w.region)}</Row>
          <Row label="Administrator">
            {w.adminName}
            {ADMIN_ROLES.includes(w.adminRole) && <span className="text-ink-500">, {w.adminRole}</span>}
          </Row>
          <Row label="Email">{w.adminEmail}</Row>
          <Row label="Sign-in step">{w.mfa === "authenticator" ? "Authenticator app" : w.mfa === "sms" ? "SMS code" : "Email code"}</Row>
        </Card>
      </div>

      <Section title="Agreements" description="Required to store and process patient health information on your behalf.">
        <div className="max-w-3xl space-y-1 rounded-2xl border border-ink-200 bg-white p-2">
          <Consent
            id="consents.terms"
            checked={data.consents.terms}
            onChange={(v) => setConsent("terms", v)}
            error={errors["consents.terms"]}
            label={
              <>
                I accept the <DocLink href="/legal/terms">terms of service</DocLink> on behalf of {o.legalName || "my organization"}
              </>
            }
          />
          <Consent
            id="consents.baa"
            checked={data.consents.baa}
            onChange={(v) => setConsent("baa", v)}
            error={errors["consents.baa"]}
            label={
              <>
                I accept the <DocLink href="/legal/baa">business associate agreement</DocLink> (HIPAA)
              </>
            }
          />
          <Consent
            id="consents.dpa"
            checked={data.consents.dpa}
            onChange={(v) => setConsent("dpa", v)}
            error={errors["consents.dpa"]}
            label={
              <>
                I accept the <DocLink href="/legal/dpa">data processing agreement</DocLink> (GDPR and local privacy law)
              </>
            }
          />
          <CheckRow
            id="consents.updates"
            checked={data.consents.updates}
            onChange={(v) => setConsent("updates", v)}
            label="Email me product updates and release notes"
            description="Optional. You can unsubscribe at any time."
          />
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-ink-600">
          After you submit, we&apos;ll email {w.adminEmail || "the administrator"} to confirm the address. Our compliance team
          reviews your license within one business day, then your workspace goes live.
        </p>
      </Section>
    </div>
  );
}

function Card({ title, step, onJump, children }: { title: string; step: StepId; onJump?: (id: StepId) => void; children: ReactNode }) {
  return (
    <section className="flex flex-col rounded-2xl border border-ink-200 bg-white">
      <header className="flex items-center justify-between gap-3 border-b border-ink-100 px-4 py-3">
        <h3 className="font-semibold text-ink-900">{title}</h3>
        <button
          type="button"
          onClick={() => onJump?.(step)}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-scrub-700 hover:bg-scrub-50"
          aria-label={`Edit ${title}`}
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          Edit
        </button>
      </header>
      <div className="space-y-2 px-4 py-3.5">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 text-sm">
      <span className="text-ink-500">{label}</span>
      <span className="break-words text-ink-900">{children}</span>
    </div>
  );
}

function DocLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="font-semibold text-scrub-700 underline decoration-scrub-300 underline-offset-2 hover:decoration-scrub-700"
    >
      {children}
    </a>
  );
}

function Consent({
  id,
  checked,
  onChange,
  label,
  error,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  error?: string;
}) {
  return (
    <div>
      <CheckRow id={id} checked={checked} onChange={onChange} label={label} invalid={!!error} />
      {error && (
        <p id={`${id}-error`} className="animate-fade-in px-11 pb-1 text-[0.8rem] font-medium text-signal">
          {error}
        </p>
      )}
    </div>
  );
}
