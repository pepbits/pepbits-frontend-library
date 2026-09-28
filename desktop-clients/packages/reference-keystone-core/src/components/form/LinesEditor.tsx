'use client';
import { Table, TableContainer } from '@pepbits/ops-ui';
import { useId } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Field } from '../../lib/types';
import { cx, isNumeric, useFormat } from '../../lib/format';
import { Button, IconButton, Input } from '../ui';
import { FieldInput } from './RecordForm';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export type Line = Record<string, unknown>;
export type LineKind = 'document' | 'voucher' | 'structure';

const n = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0);
const r2 = (x: number) => Math.round(x * 100) / 100;

export function computeLine(line: Line): Line {
  if ('qty' in line || 'rate' in line) return { ...line, amount: r2(n(line.qty) * n(line.rate)) };
  return line;
}

export function blankLine(fields: Field[]): Line {
  const blank: Line = {};
  fields.forEach((f) => (blank[f.key] = isNumeric(f) ? (f.key === 'qty' ? 1 : 0) : f.options && f.type === 'select' ? f.options[0] : ''));
  return computeLine(blank);
}

export function lineTotals(kind: LineKind, lines: Line[]) {
  if (kind === 'voucher') {
    const debit = r2(lines.reduce((s, l) => s + n(l.debit), 0));
    const credit = r2(lines.reduce((s, l) => s + n(l.credit), 0));
    return { debit, credit, diff: r2(debit - credit), total: debit, subtotal: debit, tax: 0 };
  }
  let subtotal = 0;
  let tax = 0;
  lines.forEach((l) => {
    const sign = l.kind === 'Deduction' ? -1 : 1;
    subtotal += sign * n(l.amount);
    tax += sign * n(l.amount) * (n(l.tax) / 100);
  });
  return { subtotal: r2(subtotal), tax: r2(tax), total: r2(subtotal + tax), debit: 0, credit: 0, diff: 0 };
}

function PoolInput({ field, value, onChange, readOnly }: { field: Field; value: unknown; onChange: (v: unknown) => void; readOnly?: boolean }) {
 const referenceT = useReferenceLocalization().t;

  const id = useId();
  return (
    <>
      <Input list={id} value={String(value ?? '')} readOnly={readOnly} onChange={(e) => onChange(e.target.value)} className="h-7 text-[length:calc(12.5px*var(--fs-scale))]" placeholder={referenceT("Type or pick {value0}", {value0: referenceT(field.label)})} />
      {!readOnly && <datalist id={id}>{field.pool!.map((o) => <option key={o} value={o} />)}</datalist>}
    </>
  );
}

export function LinesEditor({ fields, lines, onChange, readOnly, kind = 'document', title }: { fields: Field[]; lines: Line[]; onChange: (l: Line[]) => void; readOnly?: boolean; kind?: LineKind; title?: string }) {
 const referenceT = useReferenceLocalization().t;

  const { fmtCurrency, fmtValue } = useFormat();
  const setCell = (i: number, key: string, v: unknown) => {
    const next = lines.map((l, k) => {
      if (k !== i) return l;
      const u: Line = { ...l, [key]: v };
      if (kind === 'voucher') {
        if (key === 'debit' && n(v) > 0) u.credit = 0;
        if (key === 'credit' && n(v) > 0) u.debit = 0;
      }
      return computeLine(u);
    });
    onChange(next);
  };
  const add = () => {
    const blank: Line = {};
    fields.forEach((f) => (blank[f.key] = isNumeric(f) ? (f.key === 'qty' ? 1 : 0) : f.options && f.type === 'select' ? f.options[0] : ''));
    onChange([...lines, computeLine(blank)]);
  };
  const totals = lineTotals(kind, lines);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col rounded-lg border border-line bg-surface">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <h3 className="text-[length:calc(13px*var(--fs-scale))] font-semibold">{title ?? (kind === 'voucher' ? 'Entries' : 'Items')}</h3>
        <span className="text-[length:calc(12px*var(--fs-scale))] text-ink-3 tnum">{referenceT(lines.length === 1 ? "{count} line" : "{count} lines", {count: lines.length})}</span>
        <span className="flex-1" />
        {!readOnly && <Button size="sm" icon={Plus} onClick={add}><ReferenceText message="Add line" /></Button>}
      </div>
      <TableContainer className="min-h-0 flex-1 overflow-auto">
        <Table className="w-full border-separate border-spacing-0 text-[length:calc(13px*var(--fs-scale))]">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="w-9 border-b border-line bg-surface-2 px-2 py-1.5 text-left text-[length:calc(12px*var(--fs-scale))] font-medium text-ink-3">#</th>
              {fields.map((f) => (
                <th key={f.key} className={cx('whitespace-nowrap border-b border-line bg-surface-2 px-2 py-1.5 text-[length:calc(12px*var(--fs-scale))] font-medium text-ink-2', isNumeric(f) ? 'text-right' : 'text-left', f.pool ? 'min-w-[200px]' : isNumeric(f) ? 'w-28' : 'min-w-[110px]')}><ReferenceText message={f.label} /></th>
              ))}
              {!readOnly && <th className="w-9 border-b border-line bg-surface-2" />}
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="group">
                <td className="border-b border-line px-2 py-1 text-[length:calc(12px*var(--fs-scale))] text-ink-3 tnum">{i + 1}</td>
                {fields.map((f) => (
                  <td key={f.key} className={cx('border-b border-line px-1.5 py-1', isNumeric(f) && 'text-right')}>
                    {readOnly || f.readOnly ? (
                      <span className={cx('block px-1', isNumeric(f) && 'tnum', f.readOnly && 'font-medium')}>{isNumeric(f) && n(l[f.key]) === 0 && kind === 'voucher' ? '' : fmtValue(f, l[f.key])}</span>
                    ) : f.pool ? (
                      <PoolInput field={f} value={l[f.key]} onChange={(v) => setCell(i, f.key, v)} />
                    ) : (
                      <FieldInput field={f.type === 'percent' ? { ...f, options: undefined } : f} value={kind === 'voucher' && (f.key === 'debit' || f.key === 'credit') && !Number(l[f.key]) ? '' : l[f.key]} compact onChange={(v) => setCell(i, f.key, v === '' ? 0 : v)} />
                    )}
                  </td>
                ))}
                {!readOnly && (
                  <td className="border-b border-line px-1 text-center">
                    <IconButton icon={Trash2} size="sm" label={referenceT("Remove line {value0}", {value0: i + 1})} className="opacity-40 group-hover:opacity-100 hover:!text-danger" onClick={() => onChange(lines.filter((_, k) => k !== i))} />
                  </td>
                )}
              </tr>
            ))}
            {!lines.length && (
              <tr><td colSpan={fields.length + 2} className="px-3 py-8 text-center text-[length:calc(13px*var(--fs-scale))] text-ink-3"><ReferenceText message="No lines yet." /> {readOnly ? '' : referenceT("Use “Add line” to start.")}</td></tr>
            )}
          </tbody>
          {lines.length > 0 && (
            <tfoot className="sticky bottom-0">
              <tr className="bg-surface-2">
                <td className="border-t border-line" />
                {fields.map((f, k) => (
                  <td key={f.key} className={cx('border-t border-line px-2 py-1.5 text-[length:calc(12.5px*var(--fs-scale))] font-semibold', isNumeric(f) && 'text-right tnum')}>
                    {k === 0 ? referenceT("Total") : kind === 'voucher' && (f.key === 'debit' || f.key === 'credit') ? fmtCurrency(f.key === 'debit' ? totals.debit : totals.credit) : f.key === 'amount' ? fmtCurrency(totals.subtotal) : f.key === 'qty' && kind !== 'structure' ? lines.reduce((s, x) => s + n(x.qty), 0) : ''}
                  </td>
                ))}
                {!readOnly && <td className="border-t border-line" />}
              </tr>
            </tfoot>
          )}
        </Table>
      </TableContainer>
    </div>
  );
}
