"use client";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { humanize, useRcmFormat } from "../../lib/format";
import type { Meta, RecordDto, ResourceDef } from "../../lib/types";
import { LinesTable } from "./values";

const DOCUMENT_TITLE: Record<string, string> = {
  invoices: "Tax invoice", "debit-notes": "Debit note", "credit-notes": "Credit note", receipts: "Payment receipt",
  remittances: "Remittance advice", journals: "Journal entry", deposits: "Deposit receipt", "cash-sessions": "Drawer session",
};

/** Paper rendering of a financial document, so people see exactly what was issued. */
export function DocumentPreview({ res, rec, meta }: { res: ResourceDef; rec: RecordDto; meta: Meta }) {
  const fmt = useRcmFormat();
  const { t } = useLocalization();
  const v = rec.values;
  const lineField = res.fields.find((f) => f.type === "lines");
  const rows: Record<string, any>[] = lineField ? v[lineField.key] ?? [] : [];
  const branch = meta.branches.find((b) => b.value === rec.branch);
  const party = rec.patient ? `${rec.patient.name} (${rec.patient.mrn})` : rec.labels.payer ?? rec.title;
  const draft = rec.status === "DRAFT";
  const voided = ["VOIDED", "REVERSED"].includes(rec.status);
  const partyLabel = res.key === "remittances" ? "From payer" : res.key === "journals" ? "Source" : "Party";

  return (
    <div className="relative overflow-hidden rounded-xl border border-line bg-white shadow-[0_1px_0_#D6DCE4,0_10px_24px_-18px_rgba(10,26,46,0.45)]">
      {(draft || voided) && (
        <span className="pointer-events-none absolute right-[-48px] top-[26px] rotate-[35deg] bg-saffron-100 px-14 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-saffron-700">
          {draft ? <LocalizedText message="Draft" /> : humanize(rec.status)}
        </span>
      )}
      <div className="h-1.5 bg-gradient-to-r from-harbor-800 via-harbor-600 to-signal-500" />
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-[15px] font-semibold">{meta.tenant.name}</p>
            <p className="text-[11.5px] text-muted">{branch?.label ?? t("All branches")}</p>
          </div>
          <div className="text-right">
            <p className="font-display text-[17px] font-semibold uppercase tracking-wide text-harbor-800">{DOCUMENT_TITLE[res.key] ? t(DOCUMENT_TITLE[res.key]) : res.singular}</p>
            <p className="font-mono text-[12.5px] font-semibold">{rec.ref}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 rounded-lg bg-mist px-3 py-2.5 text-[12px]">
          <div><p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted"><LocalizedText message={partyLabel} /></p><p className="mt-0.5 font-semibold">{res.key === "journals" ? v.sourceDocument : party || "—"}</p></div>
          <div><p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted"><LocalizedText message="Date" /></p><p className="mt-0.5 font-semibold">{fmt.date(v.issuedOn ?? v.receivedOn ?? v.postingDate ?? rec.createdAt)}</p></div>
          <div><p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted"><LocalizedText message={rec.dueDate ? "Due" : "Reference"} /></p><p className="mt-0.5 font-semibold">{rec.dueDate ? fmt.date(rec.dueDate) : v.reference ?? v.paymentReference ?? (rec.labels.invoice?.split(" ")[0] || "—")}</p></div>
        </div>
        {lineField && rows.length > 0 && <div className="mt-3"><p className="mb-1 text-right text-[10.5px] text-muted"><LocalizedText message="Amounts in {value0}" values={{ value0: rec.currency }} /></p><LinesTable field={lineField} rows={rows} currency={rec.currency} dense /></div>}
        {lineField && rows.length === 0 && <p className="mt-3 rounded-lg border border-dashed border-line px-3 py-3 text-center text-[12px] text-muted"><LocalizedText message="No lines yet." /></p>}
        {!lineField && (v.reasonCode || v.note) && (
          <p className="mt-3 rounded-lg border border-line px-3 py-2.5 text-[12.5px]"><span className="font-semibold">{humanize(v.reasonCode)}</span>{v.note ? `. ${v.note}` : ""}</p>
        )}
        <div className="mt-3 flex justify-end">
          <dl className="w-[250px] space-y-1 text-[12.5px]">
            {v.subtotal !== undefined && <Row k={t("Subtotal")} v={fmt.money(v.subtotal, rec.currency)} />}
            {v.tax !== undefined && <Row k={t("VAT")} v={fmt.money(v.tax, rec.currency)} />}
            <Row k={res.amountLabel ?? t("Total")} v={fmt.money(rec.amount, rec.currency)} strong />
            {res.fields.some((f) => f.key === "balance") && <Row k={res.balanceLabel ?? t("Balance")} v={fmt.money(rec.balance, rec.currency)} tone={rec.balance > 0 ? "text-saffron-700" : "text-jade-700"} />}
          </dl>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, strong, tone }: { k: string; v: string; strong?: boolean; tone?: string }) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? "border-t border-line pt-1 text-[13.5px] font-bold" : ""}`}>
      <dt className="text-muted">{k}</dt><dd className={`tabular-nums ${tone ?? ""}`}>{v}</dd>
    </div>
  );
}
