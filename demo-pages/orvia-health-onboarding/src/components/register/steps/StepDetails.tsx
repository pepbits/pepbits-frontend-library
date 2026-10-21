"use client";

import { AffixInput, Field, Input, Select } from "@/components/ui/Field";
import { COUNTRIES, CURRENCIES, TIMEZONES, country } from "@/lib/catalog";
import type { OrgDetails } from "@/lib/registration";
import { Section } from "../Section";
import type { StepProps } from "../types";

export function StepDetails({ data, errors, setData }: StepProps) {
  const o = data.org;
  const c = country(o.country);
  const showBeds = data.facilityTypes.includes("hospital") && data.structure !== "network";

  const set = (patch: Partial<OrgDetails>) => setData((d) => ({ ...d, org: { ...d.org, ...patch } }));
  const err = (k: keyof OrgDetails) => errors[`org.${k}`];
  const bind = (k: keyof OrgDetails) => ({
    id: `org.${k}`,
    value: o[k],
    invalid: !!err(k),
    onChange: (e: { target: { value: string } }) => set({ [k]: e.target.value } as Partial<OrgDetails>),
  });

  function onCountry(code: string) {
    const prev = country(o.country);
    const next = country(code);
    set({
      country: code,
      // Fill regional defaults unless the person already chose something else
      timezone: !o.timezone || o.timezone === prev?.timezone ? (next?.timezone ?? "") : o.timezone,
      currency: !o.currency || o.currency === prev?.currency ? (next?.currency ?? "") : o.currency,
    });
  }

  return (
    <div className="space-y-10">
      <Section title="Legal identity" description="As printed on your operating license.">
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="Legal name" htmlFor="org.legalName" required error={err("legalName")} className="sm:col-span-2 xl:col-span-1">
            <Input {...bind("legalName")} placeholder="St. Mary's Medical Center LLC" autoComplete="organization" data-autofocus="true" />
          </Field>
          <Field
            label="Display name"
            htmlFor="org.displayName"
            optional
            hint="Shown to staff and patients"
            error={err("displayName")}
          >
            <Input {...bind("displayName")} placeholder="St. Mary's" />
          </Field>
          <Field
            label="License number"
            htmlFor="org.licenseNumber"
            required
            hint="Issued by your health authority or ministry"
            error={err("licenseNumber")}
          >
            <Input {...bind("licenseNumber")} placeholder="e.g. DHA-F-0001234" autoCapitalize="characters" />
          </Field>
          <Field label="Tax ID" htmlFor="org.taxId" optional hint="EIN, VAT, GST or TRN" error={err("taxId")}>
            <Input {...bind("taxId")} placeholder="e.g. 12-3456789" />
          </Field>
          {showBeds && (
            <Field label="Licensed beds" htmlFor="org.beds" required error={err("beds")}>
              <Input {...bind("beds")} type="number" inputMode="numeric" min={1} placeholder="e.g. 250" />
            </Field>
          )}
        </div>
      </Section>

      <Section title={data.structure === "network" ? "Head office" : "Location and contact"}>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="Country" htmlFor="org.country" required error={err("country")}>
            <Select
              id="org.country"
              value={o.country}
              onChange={(e) => onCountry(e.target.value)}
              invalid={!!err("country")}
              placeholder="Choose a country"
              autoComplete="country"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="City" htmlFor="org.city" required error={err("city")}>
            <Input {...bind("city")} placeholder="e.g. Dubai" autoComplete="address-level2" />
          </Field>
          <Field label="Postal code" htmlFor="org.postalCode" optional error={err("postalCode")}>
            <Input {...bind("postalCode")} autoComplete="postal-code" />
          </Field>
          <Field label="Street address" htmlFor="org.address" required error={err("address")} className="sm:col-span-2 xl:col-span-3">
            <Input {...bind("address")} placeholder="Building, street and area" autoComplete="street-address" />
          </Field>
          <Field label="Main phone" htmlFor="org.phone" required error={err("phone")}>
            <AffixInput
              {...bind("phone")}
              type="tel"
              inputMode="tel"
              prefix={c?.dial ?? "+"}
              placeholder="Phone number"
              autoComplete="tel-national"
            />
          </Field>
          <Field label="Website" htmlFor="org.website" optional error={err("website")} className="xl:col-span-2">
            <AffixInput {...bind("website")} prefix="https://" placeholder="stmarys.org" inputMode="url" autoComplete="url" />
          </Field>
        </div>
      </Section>

      <Section
        title="Regional settings"
        description={c ? `Filled in for ${c.name}. Change them if you work differently.` : "Choose a country to fill these in."}
      >
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="Time zone" htmlFor="org.timezone" required error={err("timezone")}>
            <Select
              id="org.timezone"
              value={o.timezone}
              onChange={(e) => set({ timezone: e.target.value })}
              invalid={!!err("timezone")}
              placeholder="Choose a time zone"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Billing currency" htmlFor="org.currency" required error={err("currency")}>
            <Select
              id="org.currency"
              value={o.currency}
              onChange={(e) => set({ currency: e.target.value })}
              invalid={!!err("currency")}
              placeholder="Choose a currency"
            >
              {CURRENCIES.map((cur) => (
                <option key={cur} value={cur}>
                  {cur}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Section>
    </div>
  );
}
