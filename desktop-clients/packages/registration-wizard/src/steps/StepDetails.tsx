import { AffixInput, Field, Input, Select } from "../ui/Field";
import { ListStatus } from "../ui/ListStatus";
import { MAX_BEDS, MAX_PHONE_LENGTH, needsBeds } from "../registration";
import { Section } from "../Section";
import type { StepProps } from "../step-types";
import type { OrganisationProfile } from "../types";

export function StepDetails({ data, errors, setData, lists }: StepProps) {
  const o = data.profile;
  const country = lists.countries.items.find((c) => c.code === o.country);
  const showBeds = needsBeds(data);
  const states = lists.states;
  const districts = lists.districts;
  const showStates = !!o.country && !(states.status === "ready" && states.items.length === 0);
  const showDistricts = showStates && !!o.state && !(districts.status === "ready" && districts.items.length === 0);
  const callingCode = country?.callingCode ?? "";

  const set = (patch: Partial<OrganisationProfile>) => setData((d) => ({ ...d, profile: { ...d.profile, ...patch } }));
  const err = (k: keyof OrganisationProfile) => errors[`profile.${k}`];
  const bind = (k: keyof OrganisationProfile) => ({
    id: `profile.${k}`,
    value: o[k],
    invalid: !!err(k),
    onChange: (e: { target: { value: string } }) => set({ [k]: e.target.value } as Partial<OrganisationProfile>),
  });

  return (
    <div className="space-y-10">
      <Section title="Legal identity" description="As printed on your operating licence.">
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="Legal name" htmlFor="profile.legalName" required error={err("legalName")} className="sm:col-span-2 xl:col-span-1">
            <Input {...bind("legalName")} autoComplete="organization" data-autofocus="true" />
          </Field>
          <Field label="Display name" htmlFor="profile.displayName" optional hint="Shown to staff and patients" error={err("displayName")}>
            <Input {...bind("displayName")} />
          </Field>
          <Field
            label="Licence number"
            htmlFor="profile.licenceNumber"
            required
            hint="Issued by your health authority or ministry"
            error={err("licenceNumber")}
          >
            <Input {...bind("licenceNumber")} autoCapitalize="characters" />
          </Field>
          <Field label="Tax ID" htmlFor="profile.taxId" optional error={err("taxId")}>
            <Input {...bind("taxId")} />
          </Field>
          {showBeds && (
            <Field label="Licensed beds" htmlFor="profile.beds" required hint={`1 to ${MAX_BEDS.toLocaleString()}`} error={err("beds")}>
              <Input {...bind("beds")} type="number" inputMode="numeric" min={1} max={MAX_BEDS} step={1} />
            </Field>
          )}
        </div>
      </Section>

      <Section title={data.structure === "NETWORK" ? "Head office" : "Location and contact"}>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="Country" htmlFor="profile.country" required error={err("country")}>
            <Select
              id="profile.country"
              value={o.country}
              onChange={(e) => set({ country: e.target.value, state: "", district: "" })}
              invalid={!!err("country")}
              disabled={lists.countries.status !== "ready"}
              placeholder="Choose a country"
              autoComplete="country"
            >
              {lists.countries.items.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </Select>
            <ListStatus list={lists.countries} what="countries" />
          </Field>
          {showStates && (
            <Field label="State or province" htmlFor="profile.state" required error={err("state")}>
              <Select
                id="profile.state"
                value={o.state}
                onChange={(e) => set({ state: e.target.value, district: "" })}
                invalid={!!err("state")}
                disabled={states.status !== "ready"}
                placeholder="Choose a state or province"
                autoComplete="address-level1"
              >
                {states.items.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </Select>
              <ListStatus list={states} what="states and provinces" />
            </Field>
          )}
          {showDistricts && (
            <Field label="District" htmlFor="profile.district" required error={err("district")}>
              <Select
                id="profile.district"
                value={o.district}
                onChange={(e) => set({ district: e.target.value })}
                invalid={!!err("district")}
                disabled={districts.status !== "ready"}
                placeholder="Choose a district"
              >
                {districts.items.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </Select>
              <ListStatus list={districts} what="districts" />
            </Field>
          )}
          <Field label="City" htmlFor="profile.city" required error={err("city")}>
            <Input {...bind("city")} autoComplete="address-level2" />
          </Field>
          <Field label="Postal code" htmlFor="profile.postalCode" optional error={err("postalCode")}>
            <Input {...bind("postalCode")} autoComplete="postal-code" />
          </Field>
          <Field label="Street address" htmlFor="profile.address" required error={err("address")} className="sm:col-span-2 xl:col-span-3">
            <Input {...bind("address")} placeholder="Building, street and area" autoComplete="street-address" />
          </Field>
          <Field label="Organisation phone" htmlFor="profile.phone" optional error={err("phone")}>
            <AffixInput
              {...bind("phone")}
              type="tel"
              inputMode="tel"
              prefix={callingCode || undefined}
              maxLength={Math.max(1, MAX_PHONE_LENGTH - callingCode.length)}
              autoComplete="tel-national"
            />
          </Field>
          <Field label="Website" htmlFor="profile.website" optional error={err("website")} className="xl:col-span-2">
            <AffixInput {...bind("website")} prefix="https://" placeholder="example.org" inputMode="url" autoComplete="url" />
          </Field>
        </div>
      </Section>

      <Section
        title="Regional settings"
        description={country ? `Options available for ${country.name}.` : "Choose a country to see the options."}
      >
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="Time zone" htmlFor="profile.timeZone" required error={err("timeZone")}>
            <Select
              id="profile.timeZone"
              value={o.timeZone}
              onChange={(e) => set({ timeZone: e.target.value })}
              invalid={!!err("timeZone")}
              disabled={!o.country || lists.timeZones.status !== "ready"}
              placeholder="Choose a time zone"
            >
              {lists.timeZones.items.map((tz) => (
                <option key={tz.code} value={tz.code}>
                  {tz.name}
                </option>
              ))}
            </Select>
            <ListStatus list={lists.timeZones} what="time zones" />
          </Field>
          <Field label="Billing currency" htmlFor="profile.currency" required error={err("currency")}>
            <Select
              id="profile.currency"
              value={o.currency}
              onChange={(e) => set({ currency: e.target.value })}
              invalid={!!err("currency")}
              disabled={!o.country || lists.currencies.status !== "ready"}
              placeholder="Choose a currency"
            >
              {lists.currencies.items.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name === c.code ? c.code : `${c.name} (${c.code})`}
                </option>
              ))}
            </Select>
            <ListStatus list={lists.currencies} what="currencies" />
          </Field>
        </div>
      </Section>
    </div>
  );
}
