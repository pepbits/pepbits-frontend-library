import { CircleAlert, LockKeyhole } from "lucide-react";
import { SLUG_MAX_LENGTH, SLUG_RE, isFreeEmail, isReservedSlug, normalizeSlug } from "../registration";
import { Section } from "../Section";
import type { StepProps } from "../step-types";
import type { AdministratorDetails } from "../types";
import { RadioTileGroup, SelectTile } from "../ui/Choice";
import { AffixInput, Field, Input, Select } from "../ui/Field";
import { ListStatus } from "../ui/ListStatus";

export function StepWorkspace({ data, errors, setData, lists, host }: StepProps) {
  const w = data.workspace;
  const a = data.administrator;
  const domain = host.workspaceDomain;
  const country = lists.countries.items.find((c) => c.code === data.profile.country);
  const offers = lists.offers;

  const setAdmin = (patch: Partial<AdministratorDetails>) =>
    setData((d) => ({ ...d, administrator: { ...d.administrator, ...patch } }));

  const slugProblem = w.slug.length >= 3 && (!SLUG_RE.test(w.slug) || isReservedSlug(w.slug));
  const slugHint = slugProblem ? (
    <span className="font-medium text-signal">
      {isReservedSlug(w.slug) ? "That address is reserved." : "Start with a letter and end with a letter or number."}
    </span>
  ) : (
    "Lowercase letters, numbers and hyphens, 3 to 48 characters. It can't be changed later."
  );

  return (
    <div className="space-y-10">
      <div className="grid gap-10 xl:grid-cols-2 xl:gap-12">
        <Section title="Workspace" description="Where your team signs in.">
          <div className="space-y-5">
            <Field label="Workspace address" htmlFor="workspace.slug" required error={errors["workspace.slug"]} hint={slugHint}>
              <AffixInput
                id="workspace.slug"
                value={w.slug}
                onChange={(e) => setData((d) => ({ ...d, workspace: { ...d.workspace, slug: normalizeSlug(e.target.value, domain) } }))}
                suffix={`.${domain}`}
                status={slugProblem ? <CircleAlert className="h-4 w-4 text-signal" aria-hidden="true" /> : null}
                invalid={!!errors["workspace.slug"] || slugProblem}
                placeholder="your-organisation"
                autoCapitalize="off"
                autoComplete="off"
                spellCheck={false}
                maxLength={SLUG_MAX_LENGTH}
                data-autofocus="true"
              />
            </Field>

            <div className="rounded-2xl bg-scrub-900 p-4 text-white" aria-hidden="true">
              <div className="flex items-center gap-2 rounded-xl bg-white/[0.08] px-3.5 py-2.5 text-sm ring-1 ring-white/10">
                <LockKeyhole className="h-4 w-4 shrink-0 text-mint" />
                <span className="truncate">
                  <span className="text-scrub-300">https://</span>
                  <span className="font-semibold">{w.slug || "your-organisation"}</span>
                  <span className="text-scrub-300">.{domain}</span>
                </span>
              </div>
              <p className="mt-3 px-1 text-[0.8rem] leading-relaxed text-scrub-200">
                {data.profile.displayName || data.profile.legalName || "Your organisation"}
                {data.structure === "NETWORK" && data.facilities.length > 0 ? ` with ${data.facilities.length} facilities` : ""}
              </p>
            </div>
          </div>
        </Section>

        <Section title="First administrator" description="This person sets up users, roles and facilities. You can add more admins later.">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Full name" htmlFor="administrator.fullName" required hint="First and last name" error={errors["administrator.fullName"]}>
              <Input
                id="administrator.fullName"
                value={a.fullName}
                onChange={(e) => setAdmin({ fullName: e.target.value })}
                invalid={!!errors["administrator.fullName"]}
                autoComplete="name"
              />
            </Field>
            <Field label="Role" htmlFor="administrator.role" required error={errors["administrator.role"]}>
              <Select
                id="administrator.role"
                value={a.role}
                onChange={(e) => setAdmin({ role: e.target.value })}
                invalid={!!errors["administrator.role"]}
                disabled={lists.administratorRoles.status !== "ready"}
                placeholder="Choose a role"
              >
                {lists.administratorRoles.items.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name}
                  </option>
                ))}
              </Select>
              <ListStatus list={lists.administratorRoles} what="roles" />
            </Field>
            <Field
              label="Work email"
              htmlFor="administrator.email"
              required
              error={errors["administrator.email"]}
              hint={
                isFreeEmail(a.email) ? (
                  <span className="font-medium text-caution">
                    Personal email addresses take longer to verify. Use your organisation&apos;s email if you can.
                  </span>
                ) : (
                  "We'll send a 6-digit verification code here."
                )
              }
            >
              <Input
                id="administrator.email"
                type="email"
                value={a.email}
                onChange={(e) => setAdmin({ email: e.target.value })}
                invalid={!!errors["administrator.email"]}
                autoComplete="email"
                placeholder="name@hospital.org"
              />
            </Field>
            <Field label="Mobile number" htmlFor="administrator.mobile" required error={errors["administrator.mobile"]}>
              <AffixInput
                id="administrator.mobile"
                type="tel"
                inputMode="tel"
                value={a.mobile}
                onChange={(e) => setAdmin({ mobile: e.target.value })}
                invalid={!!errors["administrator.mobile"]}
                prefix={country?.callingCode || undefined}
                maxLength={30}
                autoComplete="tel-national"
              />
            </Field>
          </div>
        </Section>
      </div>

      <Section
        title="Plan"
        description={country ? `Plans available in ${country.name}.` : "Choose your country in Organisation details to see plans."}
        error={errors["workspace.offerId"]}
        errorId="workspace.offerId"
      >
        <ListStatus list={offers} what="plans" />
        {offers.status === "ready" && offers.items.length === 0 && (
          <p className="text-sm text-ink-500">No plans are offered in this country yet. Contact us to register.</p>
        )}
        <RadioTileGroup
          id="workspace.offerId"
          label="Plan"
          invalid={!!errors["workspace.offerId"]}
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        >
          {offers.items.map((o) => (
            <SelectTile
              key={o.id}
              kind="single"
              selected={w.offerId === o.id}
              onToggle={() =>
                setData((d) =>
                  d.workspace.offerId === o.id
                    ? d
                    : // Plan terms are accepted per plan, so a new plan needs a fresh acceptance.
                      { ...d, workspace: { ...d.workspace, offerId: o.id }, agreements: { ...d.agreements, terms: false } },
                )
              }
              title={o.name}
              description={o.priceLabel}
              meta={
                <span className="text-[0.8rem] text-ink-500">
                  Terms version {o.termsVersion}
                  {o.documents.length > 0 &&
                    ` · ${o.documents.length} ${o.documents.length === 1 ? "document" : "documents"} required`}
                </span>
              }
              invalid={!!errors["workspace.offerId"]}
            />
          ))}
        </RadioTileGroup>
      </Section>
    </div>
  );
}
