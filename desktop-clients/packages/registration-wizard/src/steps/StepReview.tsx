import type { ReactNode } from "react";
import { ChevronDown, Pencil } from "lucide-react";
import { nameOf } from "../lists";
import { needsBeds, type StepId } from "../registration";
import { Section } from "../Section";
import type { StepProps } from "../step-types";
import type { Agreement, AgreementAcceptance } from "../types";
import { CheckRow } from "../ui/Choice";

type ConsentKey = "terms" | "baa" | "dpa" | "productUpdates";

export function StepReview({ data, errors, setData, onJump, lists, host }: StepProps) {
  const o = data.profile;
  const w = data.workspace;
  const a = data.administrator;
  const country = lists.countries.items.find((c) => c.code === o.country);
  const offer = lists.offers.items.find((x) => x.id === w.offerId);
  const setConsent = (k: ConsentKey, v: boolean) =>
    setData((d) => ({ ...d, agreements: { ...d.agreements, [k]: v } as AgreementAcceptance }));
  const names = (codes: string[], items: Array<{ code: string; name: string }>) => codes.map((c) => nameOf(items, c)).join(", ");
  const specialtyNames = data.specialties.map((c) => nameOf(lists.specialties.items, c));

  return (
    <div className="space-y-10">
      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        <Card title="Organisation" step="organisation" onJump={onJump}>
          <Row label="Setup">{data.structure === "NETWORK" ? "Multi-facility network" : "Single facility"}</Row>
          <Row label="Operates">{names(data.facilityTypes, lists.facilityTypes.items)}</Row>
        </Card>

        <Card title="Details" step="details" onJump={onJump}>
          <Row label="Legal name">{o.legalName}</Row>
          {o.displayName && <Row label="Display name">{o.displayName}</Row>}
          <Row label="Licence">{o.licenceNumber}</Row>
          {o.taxId && <Row label="Tax ID">{o.taxId}</Row>}
          <Row label="Location">
            {[
              o.city,
              o.district && nameOf(lists.districts.items, o.district),
              o.state && nameOf(lists.states.items, o.state),
              country?.name ?? o.country,
            ]
              .filter(Boolean)
              .join(", ")}
          </Row>
          {o.phone && (
            <Row label="Phone">
              {country?.callingCode ? `${country.callingCode} ` : ""}
              {o.phone}
            </Row>
          )}
          {o.website && <Row label="Website">{o.website}</Row>}
          <Row label="Regional">
            {nameOf(lists.timeZones.items, o.timeZone)}, {o.currency}
          </Row>
          {needsBeds(data) && <Row label="Beds">{o.beds}</Row>}
        </Card>

        {data.structure === "NETWORK" && (
          <Card title={`Facilities (${data.facilities.length})`} step="facilities" onJump={onJump}>
            <ul className="space-y-1.5">
              {data.facilities.map((f) => (
                <li key={f.id} className="flex justify-between gap-3 text-sm">
                  <span className="truncate font-medium text-ink-900">{f.name}</span>
                  <span className="shrink-0 text-ink-500">
                    {nameOf(lists.facilityTypes.items, f.type)}, {f.city}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card title="Clinical scope" step="scope" onJump={onJump}>
          <Row label="Care settings">{data.careSettings.length ? names(data.careSettings, lists.careSettings.items) : "None"}</Row>
          <Row label="Specialties">
            {specialtyNames.length === 0
              ? "None yet"
              : specialtyNames.length <= 4
                ? specialtyNames.join(", ")
                : `${specialtyNames.slice(0, 3).join(", ")} and ${specialtyNames.length - 3} more`}
          </Row>
        </Card>

        <Card title="Workspace and administrator" step="workspace" onJump={onJump}>
          <Row label="Address">
            <span className="font-semibold text-scrub-800">
              {w.slug}.{host.workspaceDomain}
            </span>
          </Row>
          <Row label="Plan">{offer ? `${offer.name}, ${offer.priceLabel}` : "Not chosen"}</Row>
          <Row label="Administrator">
            {a.fullName}
            {a.role && <span className="text-ink-500">, {nameOf(lists.administratorRoles.items, a.role)}</span>}
          </Row>
          <Row label="Email">{a.email}</Row>
          <Row label="Mobile">
            {country?.callingCode ? `${country.callingCode} ` : ""}
            {a.mobile}
          </Row>
        </Card>
      </div>

      <Section title="Agreements" description="Required to store and process patient health information on your behalf.">
        <div className="max-w-3xl space-y-1 rounded-2xl border border-ink-200 bg-white p-2">
          <Consent
            id="agreements.terms"
            checked={data.agreements.terms}
            onChange={(v) => setConsent("terms", v)}
            error={errors["agreements.terms"]}
            disabled={!offer}
            label={
              <>
                I accept the {offer ? <strong className="font-semibold">{offer.name}</strong> : "plan"} terms
                {offer ? ` (version ${offer.termsVersion})` : ""} on behalf of {o.legalName || "my organisation"}
              </>
            }
          />
          {offer && offer.termsText && (
            <details className="group mx-3 mb-2 rounded-xl border border-ink-100 bg-ink-50/60">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-scrub-700 hover:bg-ink-50">
                Read the {offer.name} terms
                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="scrollbar-thin max-h-64 overflow-y-auto whitespace-pre-line px-3 pb-3 text-[0.85rem] leading-relaxed text-ink-700">
                {offer.termsText}
              </div>
            </details>
          )}
          <Consent
            id="agreements.baa"
            checked={data.agreements.baa}
            onChange={(v) => setConsent("baa", v)}
            error={errors["agreements.baa"]}
            label={<AgreementLabel agreement={host.agreements.baa} />}
          />
          <Consent
            id="agreements.dpa"
            checked={data.agreements.dpa}
            onChange={(v) => setConsent("dpa", v)}
            error={errors["agreements.dpa"]}
            label={<AgreementLabel agreement={host.agreements.dpa} />}
          />
          <CheckRow
            id="agreements.productUpdates"
            checked={data.agreements.productUpdates}
            onChange={(v) => setConsent("productUpdates", v)}
            label="Email me product updates and release notes"
            description="Optional. You can unsubscribe at any time."
          />
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-ink-600">
          When you submit, we&apos;ll email a 6-digit code to {a.email || "the administrator"} to confirm the address
          {offer && offer.documents.length > 0 ? ", then ask for the documents your plan requires" : ""}.
        </p>
      </Section>
    </div>
  );
}

function AgreementLabel({ agreement }: { agreement: Agreement }) {
  return (
    <>
      I accept the <DocLink href={agreement.href}>{agreement.label}</DocLink> (version {agreement.version})
    </>
  );
}

function Card({ title, step, onJump, children }: { title: string; step: StepId; onJump?: (id: StepId) => void; children: ReactNode }) {
  return (
    <section className="flex flex-col rounded-2xl border border-ink-200 bg-white">
      <header className="flex items-center justify-between gap-3 border-b border-ink-100 px-4 py-3">
        <h2 className="font-semibold text-ink-900">{title}</h2>
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
  disabled,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <CheckRow id={id} checked={checked} onChange={onChange} label={label} invalid={!!error} disabled={disabled} />
      {error && (
        <p id={`${id}-error`} className="animate-fade-in px-11 pb-1 text-[0.8rem] font-medium text-signal">
          {error}
        </p>
      )}
    </div>
  );
}
