"use client";

import { useEffect, useState } from "react";
import { Check, CircleAlert, LoaderCircle, LockKeyhole, Mail, MessageSquareText, Smartphone } from "lucide-react";
import { Segmented } from "@/components/ui/Choice";
import { AffixInput, Field, Input, Select } from "@/components/ui/Field";
import { PasswordInput, PasswordStrength } from "@/components/ui/PasswordInput";
import { BRAND } from "@/lib/brand";
import { ADMIN_ROLES, DATA_REGIONS, country } from "@/lib/catalog";
import { isFreeEmail, type MfaMethod, type WorkspaceSetup } from "@/lib/registration";
import { SLUG_RE, isSlugTaken, normalizeSlug } from "@/lib/workspaces";
import { Section } from "../Section";
import type { StepProps } from "../types";

type SlugState = "idle" | "checking" | "available" | "taken" | "invalid";

export function StepWorkspace({ data, errors, setData }: StepProps) {
  const w = data.workspace;
  const c = country(data.org.country);
  const [slugState, setSlugState] = useState<SlugState>("idle");

  const set = (patch: Partial<WorkspaceSetup>) => setData((d) => ({ ...d, workspace: { ...d.workspace, ...patch } }));
  const err = (k: keyof WorkspaceSetup) => errors[`workspace.${k}`];

  useEffect(() => {
    if (!w.slug) return setSlugState("idle");
    if (!SLUG_RE.test(w.slug)) return setSlugState(w.slug.length < 3 ? "idle" : "invalid");
    setSlugState("checking");
    const t = setTimeout(() => setSlugState(isSlugTaken(w.slug) ? "taken" : "available"), 400);
    return () => clearTimeout(t);
  }, [w.slug]);

  const slugStatus =
    slugState === "checking" ? (
      <LoaderCircle className="h-4 w-4 animate-spin text-ink-400" aria-hidden="true" />
    ) : slugState === "available" ? (
      <span className="grid h-5 w-5 animate-pop place-items-center rounded-full bg-scrub-600 text-white">
        <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
      </span>
    ) : slugState === "taken" || slugState === "invalid" ? (
      <CircleAlert className="h-4 w-4 text-signal" aria-hidden="true" />
    ) : null;

  const slugHint =
    slugState === "available" ? (
      <span className="font-medium text-scrub-700">
        {w.slug}.{BRAND.domain} is available. It can&apos;t be changed later.
      </span>
    ) : slugState === "taken" ? (
      <span className="font-medium text-signal">That address is taken. Try adding your city or a short code.</span>
    ) : (
      "Lowercase letters, numbers and hyphens. It can't be changed later."
    );

  return (
    <div className="grid gap-10 xl:grid-cols-2 xl:gap-12">
      <Section title="Workspace" description="Where your team signs in and where patient data lives.">
        <div className="space-y-5">
          <Field label="Workspace address" htmlFor="workspace.slug" required error={err("slug")} hint={slugHint}>
            <AffixInput
              id="workspace.slug"
              value={w.slug}
              onChange={(e) => set({ slug: normalizeSlug(e.target.value) })}
              suffix={`.${BRAND.domain}`}
              status={slugStatus}
              invalid={!!err("slug") || slugState === "taken"}
              placeholder="your-organization"
              autoCapitalize="off"
              autoComplete="off"
              spellCheck={false}
              maxLength={32}
              data-autofocus="true"
            />
          </Field>
          <Field
            label="Data residency"
            htmlFor="workspace.region"
            required
            error={err("region")}
            hint="Patient data is stored and processed only in this region."
          >
            <Select
              id="workspace.region"
              value={w.region}
              onChange={(e) => set({ region: e.target.value })}
              invalid={!!err("region")}
              placeholder="Choose a region"
            >
              {DATA_REGIONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                  {c?.region === r.id ? " (recommended)" : ""}
                </option>
              ))}
            </Select>
          </Field>

          <div className="rounded-2xl bg-scrub-900 p-4 text-white" aria-hidden="true">
            <div className="flex items-center gap-2 rounded-xl bg-white/[0.08] px-3.5 py-2.5 text-sm ring-1 ring-white/10">
              <LockKeyhole className="h-4 w-4 shrink-0 text-mint" />
              <span className="truncate">
                <span className="text-scrub-300">https://</span>
                <span className="font-semibold">{w.slug || "your-organization"}</span>
                <span className="text-scrub-300">.{BRAND.domain}</span>
              </span>
            </div>
            <p className="mt-3 px-1 text-[0.8rem] leading-relaxed text-scrub-200">
              {data.org.displayName || data.org.legalName || "Your organization"}
              {data.structure === "network" && data.facilities.length > 0
                ? ` with ${data.facilities.length} facilities`
                : ""}
              , hosted in {DATA_REGIONS.find((r) => r.id === w.region)?.label ?? "the region you choose"}.
            </p>
          </div>
        </div>
      </Section>

      <Section title="First administrator" description="This person sets up users, roles and facilities. You can add more admins later.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Full name" htmlFor="workspace.adminName" required error={err("adminName")}>
            <Input
              id="workspace.adminName"
              value={w.adminName}
              onChange={(e) => set({ adminName: e.target.value })}
              invalid={!!err("adminName")}
              autoComplete="name"
              placeholder="Dr. Amira Haddad"
            />
          </Field>
          <Field label="Role" htmlFor="workspace.adminRole" required error={err("adminRole")}>
            <Select
              id="workspace.adminRole"
              value={w.adminRole}
              onChange={(e) => set({ adminRole: e.target.value })}
              invalid={!!err("adminRole")}
              placeholder="Choose a role"
            >
              {ADMIN_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Work email"
            htmlFor="workspace.adminEmail"
            required
            error={err("adminEmail")}
            hint={
              isFreeEmail(w.adminEmail) ? (
                <span className="font-medium text-caution">
                  Personal email addresses take longer to verify. Use your organization&apos;s email if you can.
                </span>
              ) : (
                "We'll send a verification link here."
              )
            }
          >
            <Input
              id="workspace.adminEmail"
              type="email"
              value={w.adminEmail}
              onChange={(e) => set({ adminEmail: e.target.value })}
              invalid={!!err("adminEmail")}
              autoComplete="email"
              placeholder="name@hospital.org"
            />
          </Field>
          <Field label="Mobile number" htmlFor="workspace.adminPhone" required error={err("adminPhone")}>
            <AffixInput
              id="workspace.adminPhone"
              type="tel"
              inputMode="tel"
              value={w.adminPhone}
              onChange={(e) => set({ adminPhone: e.target.value })}
              invalid={!!err("adminPhone")}
              prefix={c?.dial ?? "+"}
              autoComplete="tel-national"
            />
          </Field>
          <Field label="Password" htmlFor="workspace.password" required error={err("password")} className="sm:col-span-2">
            <PasswordInput
              id="workspace.password"
              value={w.password}
              onChange={(e) => set({ password: e.target.value })}
              invalid={!!err("password")}
              autoComplete="new-password"
            />
          </Field>
          <div className="sm:col-span-2">
            <PasswordStrength password={w.password} personal={[w.adminEmail.split("@")[0] ?? "", w.slug]} />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <p className="text-sm font-medium text-ink-800" id="mfa-label">
              Second sign-in step
            </p>
            <Segmented<MfaMethod>
              label="Second sign-in step"
              value={w.mfa}
              onChange={(v) => set({ mfa: v })}
              options={[
                { value: "authenticator", label: <><Smartphone className="h-4 w-4" aria-hidden="true" /><span>App</span></> },
                { value: "sms", label: <><MessageSquareText className="h-4 w-4" aria-hidden="true" /><span>SMS</span></> },
                { value: "email", label: <><Mail className="h-4 w-4" aria-hidden="true" /><span>Email</span></> },
              ]}
            />
            <p className="text-[0.8rem] text-ink-500">
              {w.mfa === "authenticator"
                ? "Most secure. Works with Google Authenticator, Microsoft Authenticator or 1Password."
                : w.mfa === "sms"
                  ? "We'll text a code to your mobile number each time you sign in on a new device."
                  : "We'll email a code each time you sign in on a new device."}
            </p>
          </div>
        </div>
      </Section>
    </div>
  );
}
