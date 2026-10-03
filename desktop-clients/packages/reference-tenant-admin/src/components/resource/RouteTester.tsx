"use client";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, CircleSlash, Scale } from "lucide-react";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { useApiClient } from "../../lib/api";
import { cx } from "../../lib/cx";
import { humanize, todayIso, useTenantFormat } from "../../lib/format";
import { useRefOptions } from "../form/useRefOptions";
import { Combobox } from "../ui/Combobox";
import { SourceButton, SourceDateInput, SourceSelect, Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from "../ui/controls";
import { SideDrawer } from "../ui/dialog";

interface Candidate { id: number; code: string; name: string; model: string; priority: number; scope: string; specificity: number; matched: boolean; reasons: string[] }
interface Result { item: { code: string; name: string }; serviceDate: string; outcome: { kind: "route" | "default" | "conflict" | "closed"; model?: string; message: string }; candidates: Candidate[] }

const CARE_SETTING_LABEL: Record<string, string> = { OUTPATIENT: "Outpatient", INPATIENT: "Inpatient", DAYCASE: "Daycase", EMERGENCY: "Emergency", HOME_CARE: "Home care" };
const SETTINGS = Object.keys(CARE_SETTING_LABEL);

/** The reimbursement-route tester (`POST /tools/route-test`). The server decides which route wins; this only shows it. */
export function RouteTester({ onClose }: { onClose: () => void }) {
  const { t } = useLocalization();
  const fmt = useTenantFormat();
  const api = useApiClient();
  const items = useRefOptions("items");
  const contracts = useRefOptions("contracts");
  const [itemId, setItemId] = useState<string>("");
  const [contractId, setContractId] = useState<string>("");
  const [careSetting, setCareSetting] = useState("INPATIENT");
  const [serviceDate, setServiceDate] = useState(todayIso());
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const flight = useRef<AbortController | null>(null);
  useEffect(() => () => flight.current?.abort(), []);

  const run = async () => {
    flight.current?.abort();
    const controller = (flight.current = new AbortController());
    setBusy(true); setError(null);
    try {
      const out = await api.post<Result>("/tools/route-test", { itemId: Number(itemId), contractId: contractId ? Number(contractId) : undefined, careSetting, serviceDate }, { signal: controller.signal });
      if (!controller.signal.aborted) setResult(out);
    } catch (e) {
      if (!controller.signal.aborted) { setError((e as Error).message); setResult(null); }
    } finally { if (!controller.signal.aborted) setBusy(false); }
  };

  const tone = result?.outcome.kind === "route" ? "jade" : result?.outcome.kind === "default" ? "cobalt" : "madder";

  return (
    <SideDrawer open onClose={onClose} title="Test route selection" subtitle="Runs against approved routes only. Highest priority wins, then the most specific scope. A tie refuses instead of guessing.">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="grid grid-cols-1 gap-4 border-b border-line px-6 py-4 md:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="rt-item"><LocalizedText message="Item" /><span className="text-madder-500">*</span></label>
            <Combobox id="rt-item" items={items.items} loading={items.loading} value={itemId ? [itemId] : []} onChange={(v) => setItemId(v[0] ?? "")} placeholder="Choose the billed item" />
          </div>
          <div>
            <label className="field-label" htmlFor="rt-contract"><LocalizedText message="Contract" /></label>
            <Combobox id="rt-contract" items={contracts.items} loading={contracts.loading} value={contractId ? [contractId] : []} onChange={(v) => setContractId(v[0] ?? "")} placeholder="Self-pay (no contract)" />
          </div>
          <div>
            <label className="field-label" htmlFor="rt-setting"><LocalizedText message="Care setting" /></label>
            <SourceSelect id="rt-setting" className="input" value={careSetting} onChange={(e) => setCareSetting(e.target.value)}>
              {SETTINGS.map((s) => <option key={s} value={s}>{t(CARE_SETTING_LABEL[s])}</option>)}
            </SourceSelect>
          </div>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="field-label" htmlFor="rt-date"><LocalizedText message="Service date" /></label>
              <SourceDateInput id="rt-date" className="input" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} />
            </div>
            <SourceButton className="btn-primary" onClick={run} disabled={!itemId || busy}><Scale className="h-4 w-4" /> {busy ? t("Testing…") : t("Run test")}</SourceButton>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {!result && !error && <p className="text-muted"><LocalizedText message="Choose an item and run the test to see which model would price it and why." /></p>}
          {error && <p role="alert" className="font-semibold text-madder-600"><LocalizedText message={error} /></p>}
          {result && (
            <>
              <div className={cx("flex items-start gap-3 rounded-xl border p-4",
                tone === "jade" && "border-jade-100 bg-jade-50", tone === "cobalt" && "border-cobalt-100 bg-cobalt-50", tone === "madder" && "border-madder-100 bg-madder-50")}>
                {result.outcome.kind === "route" || result.outcome.kind === "default"
                  ? <CheckCircle2 className={cx("mt-0.5 h-5 w-5", tone === "jade" ? "text-jade-600" : "text-cobalt-600")} />
                  : <CircleSlash className="mt-0.5 h-5 w-5 text-madder-600" />}
                <div>
                  <p className="font-display text-[17px] font-semibold">
                    {result.outcome.model ? t(humanize(result.outcome.model)) : t(result.outcome.kind === "conflict" ? "Ambiguous: billing refuses" : "Billing stays closed")}
                  </p>
                  <p className="mt-0.5 text-[13px] text-spruce-800"><LocalizedText message={result.outcome.message} /></p>
                  <p className="mt-1 text-[12px] text-muted">{result.item.code} {result.item.name}, {t(CARE_SETTING_LABEL[careSetting] ?? humanize(careSetting)).toLowerCase()}, {fmt.date(result.serviceDate)}</p>
                </div>
              </div>

              <p className="mb-2 mt-5 text-[13px] font-semibold"><LocalizedText message="Candidates, in evaluation order" /></p>
              <TableContainer overflow="horizontal" className="rounded-xl border border-line">
                <Table className="w-full text-left text-[12.5px]">
                  <TableHeader className="bg-mist text-muted">
                    <TableRow>
                      <TableHead scope="col" className="px-3 py-2 font-semibold"><LocalizedText message="Route" /></TableHead>
                      <TableHead scope="col" className="px-3 py-2 font-semibold"><LocalizedText message="Model" /></TableHead>
                      <TableHead scope="col" className="px-3 py-2 text-right font-semibold"><LocalizedText message="Priority" /></TableHead>
                      <TableHead scope="col" className="px-3 py-2 text-right font-semibold"><LocalizedText message="Specificity" /></TableHead>
                      <TableHead scope="col" className="px-3 py-2 font-semibold"><LocalizedText message="Result" /></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-line">
                    {result.candidates.length === 0 && <TableRow><TableCell colSpan={5} className="px-3 py-4 text-muted"><LocalizedText message="No approved routes are effective on this date." /></TableCell></TableRow>}
                    {result.candidates.map((c, i) => (
                      <TableRow key={c.id} className={cx(i === 0 && c.matched && result.outcome.kind === "route" && "bg-jade-50/60")}>
                        <TableCell className="px-3 py-2"><span className="font-semibold">{c.code}</span><span className="block truncate text-[11.5px] text-muted">{c.name}</span></TableCell>
                        <TableCell className="px-3 py-2">{t(humanize(c.model))}</TableCell>
                        <TableCell className="px-3 py-2 text-right tabular-nums">{fmt.int(c.priority)}</TableCell>
                        <TableCell className="px-3 py-2 text-right tabular-nums">{fmt.int(c.specificity)}</TableCell>
                        <TableCell className="px-3 py-2">{c.matched ? <span className="font-semibold text-jade-700"><LocalizedText message="Matches" /></span> : <span className="text-muted"><LocalizedText message="Skipped: {value0}" values={{ value0: c.reasons.join(", ") }} /></span>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <p className="mt-3 text-[11.5px] text-muted"><LocalizedText message="Specificity adds 8 for an item scope, 4 for a category, 2 for a named contract and 1 for a care-setting filter." /></p>
            </>
          )}
        </div>
      </div>
    </SideDrawer>
  );
}
