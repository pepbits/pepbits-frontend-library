"use client";
import clsx from "clsx";
import {
  Ban, Bike, CircleCheck, CirclePause, ClipboardCheck, HandCoins, Lock, PackageCheck, RefreshCw, Send, ShieldAlert, Snowflake, Stethoscope, TriangleAlert, Undo2,
} from "lucide-react";
import { ReferenceLink as Link } from "@pepbits/reference-host";
import { useMemo, useState } from "react";
import { LocalizedText } from "@pepbits/ops-ui";
import { SourceInput, Table, TableBody, TableHeader, TableRow } from "../ui/controls";
import { Button, Kbd, Segmented, StatusPill, Tag, Td, Th, TONE } from "../ui/primitives";
import { useToast } from "../ui/toast";
import { useUserName } from "../shell/ShellContext";
import { ApiError, useApiClient, useRefreshAll } from "../../lib/api";
import { age, statusOf, todayIso, usePharmacyFormat } from "../../lib/format";
import { useHotkeys } from "../../lib/hooks";
import { DispenseDialog, ReasonDialog } from "./dialogs";
import { RxChain } from "./RxChain";
import type { Alert, RxDetail as Rx } from "./types";

type Tab = "supplies" | "claims" | "authorizations" | "history";

const PRIORITY_LABEL: Record<string, string> = { routine: "Routine", urgent: "Urgent", stat: "Stat" };

/** Display name for an actor id from history rows, translating the known system actors. */
function useActorName() {
  const { t } = usePharmacyFormat();
  const name = useUserName();
  return (id: string) => t(name(id));
}

export function RxDetail({ rx, onChange }: { rx: Rx; onChange: (next: Rx) => void }) {
  const toast = useToast();
  const api = useApiClient();
  const refreshAll = useRefreshAll();
  const { t, int, ago, agoLong, dateShort, moneyC, num } = usePharmacyFormat();
  const [tab, setTab] = useState<Tab>(rx.dispensings.length ? "supplies" : "history");
  const [busy, setBusy] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [dialog, setDialog] = useState<null | "dispense" | "hold" | "cancel" | "cancel-supply" | "return" | "auth">(null);
  const [method, setMethod] = useState<"card" | "cash" | "wallet">("card");
  const [overrideRejected, setOverrideRejected] = useState(false);
  const userName = useActorName();

  /** Every action returns the refreshed prescription, so one round trip updates the pane. */
  const run = async (key: string, path: string, body?: unknown, success?: string) => {
    setBusy(key);
    try {
      const next = await api.post<Rx>(path, body);
      onChange(next);
      void refreshAll();
      if (success) toast({ tone: "ok", title: success });
      return next;
    } catch (e) {
      toast({ tone: "error", title: e instanceof ApiError ? e.message : t("Action failed.") });
      throw e;
    } finally { setBusy(null); }
  };

  const openSupply = rx.dispensings.find((d) => ["prepared", "checked"].includes(d.status));
  const lastHanded = rx.dispensings.find((d) => d.status === "handed_over");
  const majors = rx.alerts.filter((a) => a.severity === "major" && !a.overridden);
  const missingReasons = majors.filter((a) => (overrides[a.key] ?? "").trim().length < 5);
  const authNeeded = rx.alerts.some((a) => a.type === "authorization" && a.title !== "Authorization pending");
  const pendingAuth = rx.authorizations.find((a) => a.status === "requested");
  const openBill = openSupply?.bill;
  const openClaims = rx.claims.filter((c) => c.bill_id === openBill?.id);
  const rtRejected = openClaims.find((c) => c.status === "rejected" && c.workflow === "pre_adjudication");
  const due = openBill ? Math.max(0, openBill.patient_share - openBill.patient_paid) : 0;
  const today = todayIso();
  const primary = rx.coverages.find((c) => c.priority === 1 && c.valid_to >= today);

  const primaryAction = useMemo(() => {
    switch (rx.stage) {
      case "intake": return { key: "review", label: t("Start review"), icon: Stethoscope, go: () => run("review", `/prescriptions/${rx.id}/review`, undefined, t("Reviewing {value0}", { value0: rx.rx_no })) };
      case "review": return {
        key: "verify", label: majors.length === 1 ? t("Verify with 1 override") : majors.length > 1 ? t("Verify with {value0} overrides", { value0: int(majors.length) }) : t("Verify prescription"), icon: CircleCheck, disabled: missingReasons.length > 0,
        go: () => run("verify", `/prescriptions/${rx.id}/verify`, { overrides: majors.map((a) => ({ key: a.key, reason: overrides[a.key] })) }, t("{value0} verified", { value0: rx.rx_no })),
      };
      case "fill": return { key: "dispense", label: t("Prepare supply"), icon: PackageCheck, disabled: rx.items.every((i) => i.qty_remaining <= 0 || i.available <= 0), go: () => setDialog("dispense") };
      case "check": return { key: "check", label: t("Confirm final check"), icon: ClipboardCheck, go: () => run("check", `/dispensings/${openSupply!.id}/check`, undefined, t("{value0} checked", { value0: openSupply!.disp_no })) };
      case "handover": return {
        key: "handover", label: due > 0 ? t("Hand over and collect {value0}", { value0: moneyC(due) }) : t("Hand over"), icon: HandCoins, disabled: !!rtRejected && !overrideRejected,
        go: () => run("handover", `/dispensings/${openSupply!.id}/handover`, { payment_method: method, override_rejected: overrideRejected }, t("{value0} handed over", { value0: openSupply!.disp_no })),
      };
      default: return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rx, overrides, method, overrideRejected, due, t, moneyC]);

  useHotkeys({ "mod+enter": () => { if (primaryAction && !primaryAction.disabled && !busy) Promise.resolve(primaryAction.go()).catch(() => {}); } }, [primaryAction, busy], { allowInInputs: true });

  const selectChain = (key: string) => {
    if (key === "claim" || key === "remittance" || key === "payment" || key === "bill") setTab("claims");
    else if (key === "dispensing") setTab("supplies");
    else if (key === "authorization") setTab("authorizations");
    else setTab("history");
  };

  const gender = rx.patient.gender === "F" ? t("female") : rx.patient.gender === "M" ? t("male") : t("other");
  const sourceLabel = rx.source === "erx" ? t("eRx") : rx.source === "hospital" ? t("Hospital discharge") : t("Paper");

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Patient and prescription header */}
      <div className="shrink-0 border-b border-line px-5 pb-3 pt-4">
        <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/patients?id=${rx.patient.id}`} className="truncate text-[18px] font-semibold tracking-tight hover:underline">{rx.patient.name}</Link>
              <span className="num text-[13px] text-ink-2"><LocalizedText message="{value0} y, {value1}, {value2} kg" values={{ value0: int(age(rx.patient.dob)), value1: gender, value2: rx.patient.weight_kg }} /></span>
              <span className="num text-[13px] text-ink-3">{rx.patient.mrn}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {rx.patient.allergies.length ? rx.patient.allergies.map((a) => <Tag key={a} tone="danger"><TriangleAlert className="size-3" /><LocalizedText message="Allergy: {value0}" values={{ value0: a }} /></Tag>) : <Tag tone="muted"><LocalizedText message="No known allergies" /></Tag>}
              {rx.patient.conditions.map((c) => <Tag key={c} tone="neutral">{c}</Tag>)}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 text-right">
            <div className="flex items-center gap-2">
              {rx.priority !== "routine" && <Tag tone={rx.priority === "stat" ? "danger" : "warn"} className="capitalize">{PRIORITY_LABEL[rx.priority] ? t(PRIORITY_LABEL[rx.priority]) : rx.priority}</Tag>}
              <span className="num text-[15px] font-semibold">{rx.rx_no}</span>
              <StatusPill status={rx.status} />
            </div>
            <p className="text-xs text-ink-3"><LocalizedText message="{value0}, received {value1}" values={{ value0: sourceLabel, value1: agoLong(rx.received_at) }} /></p>
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12.5px] text-ink-2">
          <span><span className="text-ink-3"><LocalizedText message="Prescriber" /></span> {rx.doctor.name}, {rx.doctor.facility}</span>
          {rx.diagnosis && <span><span className="text-ink-3"><LocalizedText message="Diagnosis" /></span> <span className="num">{rx.diagnosis_code}</span> {rx.diagnosis}</span>}
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-ink-3"><LocalizedText message="Coverage" /></span>
            {rx.coverages.length === 0 && <Tag tone="muted"><LocalizedText message="Self-pay" /></Tag>}
            {rx.coverages.map((c) => {
              const expired = c.valid_to < today;
              const values = { value0: c.priority === 1 ? t("Primary") : t("Secondary"), value1: c.payer_code, value2: num(c.coverage_pct) };
              return (
                <Tag key={c.id} tone={expired ? "danger" : c.priority === 1 ? "info" : "violet"} title={t("{value0}, {value1}, member {value2}", { value0: c.payer_name, value1: c.plan_name, value2: c.member_id })}>
                  {expired ? t("{value0} {value1} {value2}%, expired", values) : c.workflow === "pre_adjudication" ? t("{value0} {value1} {value2}%, real-time", values) : t("{value0} {value1} {value2}%, after supply", values)}
                </Tag>
              );
            })}
          </span>
        </div>
      </div>

      <div className="scroll-y min-h-0 flex-1 px-5 py-4">
        <RxChain nodes={rx.chain} onSelect={selectChain} />

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
          {/* Items */}
          <div className="min-w-0 overflow-hidden rounded-xl border border-line">
            <div className="scroll-x">
              <Table className="w-full min-w-[560px]">
                <TableHeader><TableRow><Th><LocalizedText message="Medicine and directions" /></Th><Th align="right"><LocalizedText message="Prescribed" /></Th><Th align="right"><LocalizedText message="Supplied" /></Th><Th align="right"><LocalizedText message="Owed" /></Th><Th align="right"><LocalizedText message="In stock" /></Th></TableRow></TableHeader>
                <TableBody>
                  {rx.items.map((i) => {
                    const flagged = rx.alerts.some((a) => a.item_ids.includes(i.id) && a.severity === "major" && !a.overridden);
                    return (
                      <TableRow key={i.id} className={clsx(flagged && "bg-danger-wash/40")}>
                        <Td className="py-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium">{i.name}</span>
                            {i.cold_chain ? <Snowflake className="size-3.5 text-cobalt" aria-label={t("Cold chain")} /> : null}
                            {i.schedule === "controlled" && <Lock className="size-3.5 text-violet" aria-label={t("Controlled")} />}
                            {i.requires_auth ? <Tag tone={i.qty_authorized ? "ok" : "warn"} className="ml-1">{i.qty_authorized ? t("Authorized {value0}", { value0: num(i.qty_authorized) }) : t("Needs authorization")}</Tag> : null}
                          </div>
                          <p className="text-xs text-ink-3">{i.generic} {i.strength} {i.form.toLowerCase()}, {i.sig}</p>
                        </Td>
                        <Td align="right">{num(i.qty_prescribed)}</Td>
                        <Td align="right">{num(i.qty_dispensed)}{i.qty_pending > 0 && <span className="block text-[11px] text-cobalt"><LocalizedText message="+{value0} in supply" values={{ value0: num(i.qty_pending) }} /></span>}</Td>
                        <Td align="right" className={i.qty_remaining > 0 ? "font-semibold" : "text-ink-3"}>{num(i.qty_remaining)}</Td>
                        <Td align="right" className={i.available < i.qty_remaining ? "text-amber" : ""}>
                          {num(i.available)}
                          {i.batches[0] && <span className="block text-[11px] text-ink-3"><LocalizedText message="next exp {value0}" values={{ value0: dateShort(i.batches[0].expiry) }} /></span>}
                        </Td>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Safety and checks */}
          <SafetyPanel alerts={rx.alerts} editable={rx.stage === "review" || rx.stage === "intake"} overrides={overrides} setOverrides={setOverrides} userName={userName} />
        </div>

        <div className="mt-4">
          <Segmented<Tab> value={tab} onChange={setTab} items={[
            { value: "supplies", label: "Supplies", count: rx.dispensings.length },
            { value: "claims", label: "Bills and claims", count: rx.claims.length, tone: rx.claims.some((c) => c.status === "rejected") ? "danger" : undefined },
            { value: "authorizations", label: "Authorizations", count: rx.authorizations.length },
            { value: "history", label: "History", count: rx.history.length },
          ]} />
          <div className="mt-3">
            {tab === "supplies" && <Supplies rx={rx} userName={userName} />}
            {tab === "claims" && <Claims rx={rx} busy={busy} onResubmit={(id) => run(`resubmit:${id}`, `/claims/${id}/resubmit-realtime`, { note: "Corrected and resubmitted from workbench" }, t("Claim resubmitted"))} />}
            {tab === "authorizations" && <Auths rx={rx} />}
            {tab === "history" && <History rows={rx.history} userName={userName} />}
          </div>
        </div>
      </div>

      {/* Contextual action bar: only what makes sense at this stage */}
      <div className="shrink-0 border-t border-line bg-surface-2 px-5 py-3">
        {rx.stage === "handover" && openBill && (
          <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px]">
            <span><span className="text-ink-3"><LocalizedText message="Bill" /></span> <span className="num font-medium">{openBill.bill_no}</span></span>
            <span className="num"><span className="text-ink-3"><LocalizedText message="Payers" /></span> {moneyC(openBill.payer_share)}</span>
            <span className="num"><span className="text-ink-3"><LocalizedText message="Patient pays" /></span> <span className="font-semibold">{moneyC(due)}</span></span>
            {openClaims.map((c) => <span key={c.id} className="flex items-center gap-1.5"><span className="text-ink-3">{c.payer_code}</span><StatusPill status={c.status} /></span>)}
            {due > 0 && <Segmented size="sm" className="ml-auto" value={method} onChange={setMethod} items={[{ value: "card", label: "Card" }, { value: "cash", label: "Cash" }, { value: "wallet", label: "Wallet" }]} />}
          </div>
        )}
        {rx.stage === "handover" && rtRejected && (
          <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-danger/30 bg-danger-wash px-3 py-2 text-[13px] text-danger">
            <TriangleAlert className="size-4 shrink-0" />
            <span className="min-w-0 flex-1"><LocalizedText message="{value0} rejected in real time: {value1} {value2}" values={{ value0: rtRejected.claim_no, value1: rtRejected.denial_code ?? "", value2: rtRejected.denial_reason ?? "" }} /></span>
            <Button size="sm" variant="secondary" icon={<RefreshCw className="size-3.5" />} loading={busy === `resubmit:${rtRejected.id}`}
              onClick={() => run(`resubmit:${rtRejected.id}`, `/claims/${rtRejected.id}/resubmit-realtime`, { note: "Corrected and resubmitted at handover" }, t("Claim resubmitted"))}><LocalizedText message="Resubmit" /></Button>
            <label className="flex items-center gap-1.5 text-ink"><SourceInput type="checkbox" checked={overrideRejected} onChange={(e) => setOverrideRejected(e.target.checked)} className="accent-[var(--danger)]" /><LocalizedText message="Hand over with the claim outstanding" /></label>
          </div>
        )}
        {rx.stage === "review" && missingReasons.length > 0 && (
          <p className="mb-2 flex items-center gap-1.5 text-[12.5px] text-danger"><ShieldAlert className="size-3.5" />{missingReasons.length === 1
            ? <LocalizedText message="Write an override reason for 1 major alert to verify, or hold the prescription for clarification." />
            : <LocalizedText message="Write an override reason for {value0} major alerts to verify, or hold the prescription for clarification." values={{ value0: int(missingReasons.length) }} />}</p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {primaryAction && (
            <Button variant="primary" size="lg" icon={<primaryAction.icon className="size-4" />} loading={busy === primaryAction.key} disabled={primaryAction.disabled} onClick={() => { Promise.resolve(primaryAction.go()).catch(() => {}); }}>
              {primaryAction.label}
            </Button>
          )}
          {primaryAction && <span className="hidden items-center gap-1 text-xs text-ink-3 lg:flex"><Kbd>⌘</Kbd><Kbd>↵</Kbd></span>}
          <span className="flex-1" />
          {(rx.stage === "review" || rx.stage === "fill") && primary && (authNeeded || pendingAuth) && (
            pendingAuth
              ? <Button icon={<Send className="size-4" />} loading={busy === "decide"} onClick={() => run("decide", `/authorizations/${pendingAuth.id}/decide`, {}, t("Payer decision recorded"))}><LocalizedText message="Get payer decision (demo)" /></Button>
              : <Button icon={<Send className="size-4" />} loading={busy === "auth"} onClick={() => setDialog("auth")}><LocalizedText message="Request authorization" /></Button>
          )}
          {(rx.stage === "intake" || rx.stage === "review" || (rx.stage === "fill" && rx.status === "verified")) && rx.status !== "on_hold" && (
            <Button icon={<CirclePause className="size-4" />} onClick={() => setDialog("hold")}><LocalizedText message="Hold for clarification" /></Button>
          )}
          {(rx.stage === "check" || rx.stage === "handover") && openSupply && <Button variant="danger" icon={<Ban className="size-4" />} onClick={() => setDialog("cancel-supply")}><LocalizedText message="Cancel supply" /></Button>}
          {rx.stage === "done" && lastHanded && rx.status !== "cancelled" && <Button icon={<Undo2 className="size-4" />} onClick={() => setDialog("return")}><LocalizedText message="Return medicine" /></Button>}
          {["intake", "review", "fill"].includes(rx.stage) && !openSupply && <Button variant="ghost" onClick={() => setDialog("cancel")}><LocalizedText message="Cancel prescription" /></Button>}
        </div>
      </div>

      {dialog === "dispense" && (
        <DispenseDialog rx={rx} open onClose={() => setDialog(null)}
          onConfirm={async (items, collection) => {
            const next = await run("dispense", `/prescriptions/${rx.id}/dispensings`, { items, collection });
            const supply = next.dispensings[0];
            const rej = next.claims.find((c) => c.bill_id === supply?.bill?.id && c.status === "rejected");
            toast(rej
              ? { tone: "error", title: t("{value0} prepared, but {value1} was rejected", { value0: supply.disp_no, value1: rej.claim_no }), body: t("{value0}: {value1}", { value0: rej.denial_code ?? "", value1: rej.denial_reason ?? "" }) }
              : { tone: "ok", title: t("{value0} prepared", { value0: supply.disp_no }), body: t("Stock reserved. Ready for the final check.") });
          }} />
      )}
      <ReasonDialog open={dialog === "auth"} onClose={() => setDialog(null)} title={t("Request authorization from {value0}", { value0: primary?.payer_code ?? t("payer") })}
        sub={t("Sent with the medicine, quantity and diagnosis. Track the reply under Prior authorizations.")} label="Clinical justification" confirm="Send request"
        presets={["Failed or intolerant to first-line therapy", "Contraindication to preferred alternative", "Continuation of established therapy"]}
        onConfirm={async (justification) => { await run("auth", `/prescriptions/${rx.id}/authorizations`, { justification }, t("Authorization requested from {value0}", { value0: primary?.payer_code ?? t("payer") })); }} />
      <ReasonDialog open={dialog === "hold"} onClose={() => setDialog(null)} title={t("Hold {value0}", { value0: rx.rx_no })} sub={t("The prescription leaves the active queue until you resume it.")} label="What needs clarifying?" confirm="Put on hold"
        presets={["Called prescriber to confirm dose", "Waiting for prescriber to clarify duration", "Patient to confirm current medicines"]}
        onConfirm={async (note) => { await run("hold", `/prescriptions/${rx.id}/hold`, { note }, t("{value0} on hold", { value0: rx.rx_no })); }} />
      <ReasonDialog open={dialog === "cancel"} onClose={() => setDialog(null)} title={t("Cancel {value0}", { value0: rx.rx_no })} label="Reason" confirm="Cancel prescription" danger
        presets={["Prescriber cancelled", "Duplicate prescription", "Patient declined"]}
        onConfirm={async (reason) => { await run("cancel", `/prescriptions/${rx.id}/cancel`, { reason }, t("{value0} cancelled", { value0: rx.rx_no })); }} />
      <ReasonDialog open={dialog === "cancel-supply"} onClose={() => setDialog(null)} title={openSupply ? t("Cancel {value0}", { value0: openSupply.disp_no }) : t("Cancel supply")} sub={t("Reserved stock is released, the bill is reversed and open claims are reversed.")} label="Reason" confirm="Cancel supply" danger
        presets={["Patient did not collect", "Wrong strength picked", "Prescriber changed therapy"]}
        onConfirm={async (reason) => { await run("cancel-supply", `/dispensings/${openSupply!.id}/cancel`, { reason }, t("Supply cancelled")); }} />
      <ReasonDialog open={dialog === "return"} onClose={() => setDialog(null)} title={lastHanded ? t("Return {value0}", { value0: lastHanded.disp_no }) : t("Return")} sub={t("Returned medicine goes to quarantine, never back to sellable stock. Claims are reversed and the patient is refunded.")} label="Reason" confirm="Record return" danger
        presets={["Adverse reaction reported", "Supplied in error", "Therapy stopped by prescriber"]}
        onConfirm={async (reason) => { await run("return", `/dispensings/${lastHanded!.id}/return`, { reason }, t("Return recorded")); }} />
    </div>
  );
}

function SafetyPanel({ alerts, editable, overrides, setOverrides, userName }: {
  alerts: Alert[]; editable: boolean; overrides: Record<string, string>; setOverrides: (o: Record<string, string>) => void; userName: (id: string) => string;
}) {
  const { t, int } = usePharmacyFormat();
  const open = alerts.filter((a) => !a.overridden && a.severity !== "info").length;
  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-line">
      <div className="flex items-center gap-2 border-b border-line px-3.5 py-2.5">
        <ShieldAlert className={clsx("size-4", open ? "text-danger" : "text-ok")} />
        <p className="text-[13px] font-semibold"><LocalizedText message="Safety and coverage checks" /></p>
        <span className="ml-auto text-xs text-ink-3">{alerts.length === 0 ? t("All clear") : alerts.length === 1 ? t("1 finding") : t("{value0} findings", { value0: int(alerts.length) })}</span>
      </div>
      {alerts.length === 0 && <p className="flex items-center gap-2 px-3.5 py-4 text-[13px] text-ok"><CircleCheck className="size-4" /><LocalizedText message="No allergy, interaction, dose or coverage issues found." /></p>}
      <ul className="divide-y divide-line">
        {alerts.map((a) => {
          const tone = a.overridden ? "muted" : a.severity === "major" ? "danger" : a.severity === "moderate" ? "warn" : "info";
          return (
            <li key={a.key} className="px-3.5 py-2.5">
              <div className="flex items-start gap-2">
                <span className={clsx("mt-1.5 size-2 shrink-0 rounded-full", TONE[tone].dot)} />
                <div className="min-w-0 flex-1">
                  <p className={clsx("text-[13px] font-medium", a.overridden ? "text-ink-2 line-through decoration-ink-3/40" : TONE[tone].text)}>
                    {a.title}{a.type === "cold_chain" && <Snowflake className="ml-1 inline size-3.5" />}{a.type === "controlled" && <Lock className="ml-1 inline size-3.5" />}
                  </p>
                  <p className="text-xs text-ink-2">{a.detail}</p>
                  {a.overridden && <p className="mt-1 text-xs text-ink-3"><LocalizedText message="Overridden by {value0}: {value1}" values={{ value0: userName(a.overridden.actor), value1: a.overridden.reason }} /></p>}
                  {editable && !a.overridden && a.severity === "major" && (
                    <SourceInput value={overrides[a.key] ?? ""} onChange={(e) => setOverrides({ ...overrides, [a.key]: e.target.value })}
                      placeholder="Override reason, e.g. prescriber confirmed by phone" aria-label={t("Override reason for {value0}", { value0: a.title })}
                      className="mt-1.5 h-7 w-full rounded-md border border-danger/40 bg-surface px-2 text-xs placeholder:text-ink-3 focus:border-danger focus:outline-none focus:ring-2 focus:ring-danger/15" />
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Supplies({ rx, userName }: { rx: Rx; userName: (id: string) => string }) {
  const { money, dateShort, dateTime, num } = usePharmacyFormat();
  if (!rx.dispensings.length) return <p className="py-4 text-[13px] text-ink-3"><LocalizedText message="Nothing supplied yet. Verified prescriptions move to Fill, where you prepare a full or part supply." /></p>;
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {rx.dispensings.map((d) => (
        <div key={d.id} className="rounded-xl border border-line">
          <div className="flex items-center gap-2 border-b border-line px-3.5 py-2">
            <span className="num text-[13px] font-semibold">{d.disp_no}</span>
            <StatusPill status={d.status} />
            {d.collection === "delivery" && <Tag tone="violet"><Bike className="size-3" /><LocalizedText message="Delivery" /></Tag>}
            <span className="ml-auto text-xs text-ink-3">{dateTime(d.handed_over_at ?? d.created_at)}</span>
          </div>
          <ul className="px-3.5 py-2 text-[12.5px]">
            {d.items.map((it) => (
              <li key={it.id} className="flex items-center gap-2 py-0.5">
                <span className="num w-8 text-right font-medium">{num(it.qty)}</span><span className="truncate">{it.name}</span>
                <span className="num ml-auto shrink-0 text-ink-3"><LocalizedText message="{value0}, exp {value1}" values={{ value0: it.batch_no, value1: dateShort(it.expiry) }} /></span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line bg-surface-2 px-3.5 py-2 text-xs text-ink-2">
            <span><LocalizedText message="Prepared by {value0}" values={{ value0: userName(d.prepared_by) }} /></span>
            {d.checked_by && <span><LocalizedText message="Checked by {value0}" values={{ value0: userName(d.checked_by) }} /></span>}
            {d.bill && <span className="num ml-auto"><LocalizedText message="{value0}: patient {value1}, payers {value2}" values={{ value0: d.bill.bill_no, value1: money(d.bill.patient_share), value2: money(d.bill.payer_share) }} /> <StatusPill status={d.bill.status} className="ml-1" /></span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function Claims({ rx, busy, onResubmit }: { rx: Rx; busy: string | null; onResubmit: (id: string) => void }) {
  const { t, int, money } = usePharmacyFormat();
  if (!rx.claims.length) return <p className="py-4 text-[13px] text-ink-3"><LocalizedText message="No claims yet. A claim is created for each payer with a share when a supply is prepared." /></p>;
  return (
    <div className="scroll-x rounded-xl border border-line">
      <Table className="w-full min-w-[720px]">
        <TableHeader><TableRow><Th><LocalizedText message="Claim" /></Th><Th><LocalizedText message="Payer" /></Th><Th><LocalizedText message="Workflow" /></Th><Th align="right"><LocalizedText message="Claimed" /></Th><Th align="right"><LocalizedText message="Contract" /></Th><Th align="right"><LocalizedText message="Approved" /></Th><Th align="right"><LocalizedText message="Paid" /></Th><Th><LocalizedText message="Status" /></Th><Th /></TableRow></TableHeader>
        <TableBody>
          {rx.claims.map((c) => (
            <TableRow key={c.id}>
              <Td><Link href={`/claims?claim=${c.id}`} className="num font-medium text-cobalt hover:underline">{c.claim_no}</Link>{c.submissions > 1 && <span className="ml-1 text-[11px] text-ink-3"><LocalizedText message="sent {value0}x" values={{ value0: int(c.submissions) }} /></span>}</Td>
              <Td>{c.payer_code} <span className="text-ink-3">{c.priority === 1 ? t("primary") : t("secondary")}</span></Td>
              <Td className="text-ink-2">{c.workflow === "pre_adjudication" ? t("Real-time") : t("After supply")}</Td>
              <Td align="right">{money(c.claimed)}</Td>
              <Td align="right" className={c.expected < c.claimed ? "text-amber" : ""}>{money(c.expected)}</Td>
              <Td align="right">{money(c.approved)}</Td>
              <Td align="right">{money(c.paid)}</Td>
              <Td><StatusPill status={c.status} />{c.denial_code && <p className="text-[11px] text-danger">{c.denial_code} {c.denial_reason}</p>}</Td>
              <Td align="right">{c.status === "rejected" && <Button size="sm" loading={busy === `resubmit:${c.id}`} onClick={() => onResubmit(c.id)}><LocalizedText message="Resubmit" /></Button>}</Td>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function Auths({ rx }: { rx: Rx }) {
  const { dateShort, dateTime, num } = usePharmacyFormat();
  if (!rx.authorizations.length) return <p className="py-4 text-[13px] text-ink-3">{rx.items.some((i) => i.requires_auth) ? <LocalizedText message="This prescription has medicines that need payer approval. Request it from the action bar." /> : <LocalizedText message="No medicine on this prescription needs prior authorization." />}</p>;
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {rx.authorizations.map((a) => (
        <div key={a.id} className="rounded-xl border border-line px-3.5 py-2.5 text-[13px]">
          <div className="flex items-center gap-2"><Link href={`/authorizations?id=${a.id}`} className="num font-semibold text-cobalt hover:underline">{a.auth_no}</Link><StatusPill status={a.status} /><span className="ml-auto text-xs text-ink-3">{a.payer_name}</span></div>
          {a.items.map((it) => <p key={it.name} className="num mt-1 text-xs text-ink-2"><LocalizedText message="{value0}: {value1} of {value2} approved" values={{ value0: it.name, value1: num(it.qty_approved), value2: num(it.qty_requested) }} /></p>)}
          <p className="mt-1 text-xs text-ink-3">
            <LocalizedText message="Requested {value0}" values={{ value0: dateTime(a.requested_at) }} />
            {a.decided_at ? <>, <LocalizedText message="decided {value0}" values={{ value0: dateTime(a.decided_at) }} /></> : null}
            {a.valid_to ? <>, <LocalizedText message="valid to {value0}" values={{ value0: dateShort(a.valid_to) }} /></> : null}
            {a.note ? <>. {a.note}</> : null}
          </p>
        </div>
      ))}
    </div>
  );
}

export function History({ rows, userName }: { rows: { id: number; entity: string; ref: string; from_status: string | null; to_status: string; note: string | null; actor: string; at: string }[]; userName: (id: string) => string }) {
  const { entityLabel, statusLabel, dateTime } = usePharmacyFormat();
  return (
    <ol className="relative ml-1.5 border-l border-line pl-5">
      {rows.map((h) => (
        <li key={h.id} className="relative pb-3 last:pb-0">
          <span className={clsx("absolute -left-[25px] top-1.5 size-2 rounded-full ring-4 ring-surface", TONE[statusOf(h.to_status).tone].dot)} />
          <p className="text-[13px]">
            <span className="text-ink-3">{entityLabel(h.entity)}</span> <span className="num font-medium">{h.ref}</span>{" "}
            {h.from_status ? <span className="text-ink-3"><LocalizedText message="moved from {value0} to" values={{ value0: statusLabel(h.from_status) }} /> </span> : <span className="text-ink-3"><LocalizedText message="created as" /> </span>}
            <StatusPill status={h.to_status} className="align-middle" />
          </p>
          <p className="text-xs text-ink-3"><LocalizedText message="{value0} by {value1}" values={{ value0: dateTime(h.at), value1: userName(h.actor) }} />{h.note ? <>. {h.note}</> : null}</p>
        </li>
      ))}
    </ol>
  );
}
