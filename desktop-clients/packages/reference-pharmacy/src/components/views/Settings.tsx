"use client";
import { Moon, Sun } from "lucide-react";
import { LocalizedText } from "@pepbits/ops-ui";
import { useShell } from "../shell/ShellContext";
import { Avatar, ErrorNote, ListSkeleton, Panel, PanelHeader, Segmented, Tag } from "../ui/primitives";
import { useApi, useApiClient } from "../../lib/api";
import { usePharmacyFormat } from "../../lib/format";
import { useAction } from "../../lib/useAction";

interface Payer { id: string; name: string; code: string; type: string; workflow: "pre_adjudication" | "post_dispense"; payment_terms_days: number; members: number; claims_30d: number; denial_rate: number | null }

/** Payer and staff-role values as the server names them; anything else is shown as it comes. */
const PAYER_TYPE: Record<string, { label: string }> = { insurer: { label: "Insurer" }, tpa: { label: "TPA" }, government: { label: "Government" } };
const ROLE: Record<string, { label: string }> = {
  admin: { label: "Admin" }, pharmacist: { label: "Pharmacist" }, technician: { label: "Technician" }, cashier: { label: "Cashier" }, delivery: { label: "Delivery" },
};

export function SettingsView() {
  const { meta, theme, toggleTheme, canChangeTheme } = useShell();
  const api = useApiClient();
  const { t, plural, num } = usePharmacyFormat();
  const { data: payers, error, mutate } = useApi<Payer[]>("/payers");
  const { run, busy } = useAction();

  const setWorkflow = (p: Payer, workflow: Payer["workflow"]) =>
    run(`wf-${p.id}`, async ({ operationKey }) => { const r = await api.patch<Payer>(`/payers/${p.id}`, { workflow }, { operationKey }); await mutate(); return r; },
      workflow === "pre_adjudication" ? t("{value0} now claims in real time before handover", { value0: p.code }) : t("{value0} now claims after supply", { value0: p.code }),
      "Applies to supplies prepared from now on. Existing claims keep their history.");

  const s = meta?.settings ?? {};
  const details = [
    { label: "Name", v: s.pharmacy_name }, { label: "Branch", v: s.branch_name }, { label: "Licence", v: s.license_no }, { label: "Currency", v: s.currency },
    { label: "Timezone", v: s.timezone }, { label: "Near-expiry window", v: s.near_expiry_days ? (Number.isFinite(Number(s.near_expiry_days)) ? plural(Number(s.near_expiry_days), "day") : s.near_expiry_days) : undefined },
  ];
  return (
    <div className="scroll-y h-full">
      <div className="mx-auto grid max-w-[1200px] gap-4 p-3 md:p-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]">
        <Panel className="xl:row-span-2">
          <PanelHeader title="Payers and claim workflow" sub="Choose per payer whether claims are adjudicated before the patient leaves, or submitted after supply." />
          {error ? <ErrorNote error={error} onRetry={() => mutate()} /> : !payers ? <ListSkeleton rows={5} /> : (
            <ul className="divide-y divide-line">
              {payers.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-[13.5px] font-semibold">{p.name}<Tag tone="muted">{p.code}</Tag><span className="text-xs font-normal text-ink-3">{PAYER_TYPE[p.type] ? <LocalizedText message={PAYER_TYPE[p.type].label} /> : p.type}</span></p>
                    <p className="num mt-0.5 text-xs text-ink-3">
                      <LocalizedText message="{value0}, {value1} in 30 days, denial rate {value2}%, paid within {value3}"
                        values={{ value0: plural(p.members, "member"), value1: plural(p.claims_30d, "claim"), value2: num(p.denial_rate ?? 0), value3: plural(p.payment_terms_days, "day") }} />
                    </p>
                  </div>
                  <Segmented size="sm" value={p.workflow} onChange={(v) => { if (v !== p.workflow) setWorkflow(p, v); }}
                    items={[{ value: "pre_adjudication", label: busy === `wf-${p.id}` ? "Saving" : "Real-time, before handover" }, { value: "post_dispense", label: "After supply, in batches" }]} />
                </li>
              ))}
            </ul>
          )}
          <p className="border-t border-line px-4 py-3 text-xs text-ink-3">
            <LocalizedText message="Real-time payers return a decision while the patient waits, so the co-pay is final at the counter. Batch payers are submitted nightly and answer with a remittance advice days later." />
          </p>
        </Panel>

        <Panel>
          <PanelHeader title="Appearance" />
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <p className="text-[13px] text-ink-2"><LocalizedText message="Theme" /></p>
            <Segmented size="sm" value={theme} disabled={!canChangeTheme} onChange={(v) => { if (v !== theme) toggleTheme(); }}
              items={[{ value: "light", label: <span className="flex items-center gap-1"><Sun className="size-3.5" /><LocalizedText message="Light" /></span> }, { value: "dark", label: <span className="flex items-center gap-1"><Moon className="size-3.5" /><LocalizedText message="Dark" /></span> }]} />
          </div>
          {!canChangeTheme && <p className="px-4 pb-3 text-xs text-ink-3"><LocalizedText message="Your organisation manages the theme." /></p>}
        </Panel>

        <Panel>
          <PanelHeader title="Pharmacy" sub="Configured on the server. Currency and timezone apply to every screen." />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-3 text-[13px]">
            {details.map((d) => (
              <div key={d.label}><dt className="text-[11.5px] text-ink-3"><LocalizedText message={d.label} /></dt><dd className="num">{d.v ?? "—"}</dd></div>
            ))}
          </dl>
        </Panel>

        <Panel className="xl:col-span-2">
          <PanelHeader title="People" sub="People who appear in the record history. Every action is recorded under the account you are signed in with." />
          <ul className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
            {meta?.users.map((u) => (
              <li key={u.id} className="flex items-center gap-3 rounded-lg border border-line px-3.5 py-2.5">
                <Avatar initials={u.initials} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{u.name}</p>
                  <p className="text-xs capitalize text-ink-3">{ROLE[u.role] ? <LocalizedText message={ROLE[u.role].label} /> : u.role}</p>
                </div>
                {u.id === meta.currentUser?.id && <Tag tone="info"><LocalizedText message="Signed in" /></Tag>}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
