'use client';
import type { Row } from '../../lib/types';
import type { CompanyProfile } from '../../lib/api';
import { useFormat } from '../../lib/format';
import { lineTotals, type Line } from '../form/LinesEditor';
import { PrintTable } from '../ui';
import { LogoMark } from '../shell/Logo';
import { LocalizedText as ReferenceText, useLocalization } from '@pepbits/ops-ui';
import { useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';



/**
 * Printable tax invoice (source Keystone layout). Company identity, bank details and terms
 * come from GET /api/company-profile via the `company` prop; nothing is invented here.
 */
export function KeystoneInvoice({ row, customer, copy, showTerms, company }: { row: Row; customer: Row | null; copy: string; showTerms: boolean; company: CompanyProfile }) {
 const referenceT = useReferenceLocalization().t;

  const { amountInWords, fmtCurrency, fmtDate, fmtNumber } = useFormat();
  const { t: translate } = useLocalization();
  const lines = (row.lines as Line[]) ?? [];
  const t = lineTotals('document', lines);
  return (
    <div className="print-area flex min-h-[1123px] w-[794px] flex-col bg-white p-12 text-[length:calc(12px*var(--fs-scale))] leading-relaxed text-[#1c2422] shadow-pop" style={{ fontFamily: 'var(--font-sans)' }}>
      <div className="flex items-start justify-between border-b-2 border-[#136f63] pb-5">
        <div className="flex items-start gap-3">
          <LogoMark size={40} />
          <div>
            <div className="text-[length:calc(18px*var(--fs-scale))] font-semibold">{company.company}</div>
            <div className="text-[#5d6b68]">{company.address}</div>
            <div className="text-[#5d6b68]"><ReferenceText message="Tax reg." /> {company.taxId}, {company.email}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[length:calc(22px*var(--fs-scale))] font-semibold tracking-tight text-[#136f63]"><ReferenceText message="Tax invoice" /></div>
          <div className="text-[length:calc(11px*var(--fs-scale))] font-medium text-[#5d6b68]">{translate(copy)} <ReferenceText message="copy" /></div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-8">
        <div>
          <div className="mb-1 text-[length:calc(11px*var(--fs-scale))] font-semibold text-[#5d6b68]"><ReferenceText message="Bill to" /></div>
          <div className="text-[length:calc(14px*var(--fs-scale))] font-semibold">{row.customer}</div>
          {customer && (
            <>
              <div>{customer.contact}</div>
              <div>{customer.city}, {customer.country}</div>
              <div>{customer.email}</div>
            </>
          )}
        </div>
        <PrintTable className="self-start text-right">
          <tbody>
            {[['Invoice no.', row.code], ['Invoice date', fmtDate(row.date)], ['Due date', fmtDate(row.dueDate)], ['Salesperson', row.salesperson], ['Terms', customer?.paymentTerms ?? company.paymentTerms]].map(([k, v]) => (
              <tr key={String(k)}><td className="pr-4 text-[#5d6b68]">{translate(String(k))}</td><td className="font-medium">{String(v ?? '')}</td></tr>
            ))}
          </tbody>
        </PrintTable>
      </div>

      <PrintTable className="mt-8 w-full border-collapse">
        <thead>
          <tr className="bg-[#eef4f2] text-left text-[length:calc(11px*var(--fs-scale))] text-[#3e4d4a]">
            <th className="w-8 px-2 py-2 font-semibold">#</th>
            <th className="px-2 py-2 font-semibold"><ReferenceText message="Description" /></th>
            <th className="px-2 py-2 text-right font-semibold"><ReferenceText message="Qty" /></th>
            <th className="px-2 py-2 text-right font-semibold"><ReferenceText message="Rate" /></th>
            <th className="px-2 py-2 text-right font-semibold"><ReferenceText message="Tax" /></th>
            <th className="px-2 py-2 text-right font-semibold"><ReferenceText message="Amount" /></th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} className="border-b border-[#e1e8e6]">
              <td className="px-2 py-2 tnum">{i + 1}</td>
              <td className="px-2 py-2">{String(l.item)}</td>
              <td className="px-2 py-2 text-right tnum">{fmtNumber(Number(l.qty))}</td>
              <td className="px-2 py-2 text-right tnum">{fmtCurrency(Number(l.rate))}</td>
              <td className="px-2 py-2 text-right tnum">{fmtNumber(Number(l.tax ?? 0))}%</td>
              <td className="px-2 py-2 text-right tnum">{fmtCurrency(Number(l.amount))}</td>
            </tr>
          ))}
        </tbody>
      </PrintTable>

      <div className="mt-4 flex justify-between gap-8">
        <div className="max-w-[360px] pt-2">
          <div className="text-[length:calc(11px*var(--fs-scale))] font-semibold text-[#5d6b68]"><ReferenceText message="Amount in words" /></div>
          <div className="font-medium">{amountInWords(t.total)}</div>
          <div className="mt-4 text-[length:calc(11px*var(--fs-scale))] font-semibold text-[#5d6b68]"><ReferenceText message="Pay to" /></div>
          <div>{company.bank}, {company.account}</div>
          <div><ReferenceText message="IFSC" /> {company.ifsc}<ReferenceText message=", SWIFT" /> {company.swift}</div>
        </div>
        <PrintTable className="w-64 self-start">
          <tbody>
            <tr><td className="py-1 text-[#5d6b68]"><ReferenceText message="Subtotal" /></td><td className="py-1 text-right tnum">{fmtCurrency(t.subtotal)}</td></tr>
            <tr><td className="py-1 text-[#5d6b68]"><ReferenceText message="Tax" /></td><td className="py-1 text-right tnum">{fmtCurrency(t.tax)}</td></tr>
            <tr className="border-t-2 border-[#136f63]"><td className="py-2 text-[length:calc(14px*var(--fs-scale))] font-semibold"><ReferenceText message="Total due" /></td><td className="py-2 text-right text-[length:calc(14px*var(--fs-scale))] font-semibold tnum">{fmtCurrency(t.total)}</td></tr>
          </tbody>
        </PrintTable>
      </div>

      <div className="flex-1" />
      {showTerms && (
        <div className="mt-8 border-t border-[#e1e8e6] pt-3 text-[length:calc(10.5px*var(--fs-scale))] text-[#5d6b68]">
          <div className="font-semibold text-[#3e4d4a]"><ReferenceText message="Terms" /></div>
          {company.invoiceTerms}
        </div>
      )}
      <div className="mt-10 flex items-end justify-between">
        <div className="text-[length:calc(10.5px*var(--fs-scale))] text-[#8a9794]"><ReferenceText message="This is a computer-generated invoice." /></div>
        <div className="text-center">
          <div className="h-10" />
          <div className="border-t border-[#3e4d4a] px-6 pt-1 text-[length:calc(11px*var(--fs-scale))]"><ReferenceText message="For" /> {company.company}<ReferenceText message=", authorised signatory" /></div>
        </div>
      </div>
    </div>
  );
}
