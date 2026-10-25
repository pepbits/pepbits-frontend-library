'use client';

import {TableRow} from '@pepbits/components';

import clsx from 'clsx';
import { Plus, RotateCcw, Save, ShieldCheck } from '@pepbits/icons';
import { usePathname, useRouter, useSearchParams } from '../host';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { Dialog, useErrorToast, useToast } from '../components/ui/overlay';
import { Badge, Button, Checkbox, ErrorNote, Field, Input, PageHeader, Select, Skeleton, Tabs, Toggle, SettleTable } from '../components/ui/primitives';
import { useApi, useMutation, useRevalidateAll, useSettleApi } from '../lib/api';
import { GROUP_LABEL, roleLabel } from '../lib/format';
import { useSession } from '../lib/session';

type ColType = 'text' | 'number' | 'bool' | 'select' | 'groups';
interface Col { key: string; label: string; type: ColType; options?: { value: string | number; label: string }[]; width?: string; readOnly?: boolean }
type Row = Record<string, unknown>;

const SECTIONS = [
  { value: 'payment-modes', label: 'Payment modes' }, { value: 'counters', label: 'Counters' }, { value: 'number-series', label: 'Number series' },
  { value: 'discount-categories', label: 'Discount categories' }, { value: 'rate-plans', label: 'Rate plans' }, { value: 'users', label: 'Users and rights' },
  { value: 'preferences', label: 'Preferences' },
] as const;
type Section = (typeof SECTIONS)[number]['value'];

export default function SettingsPage() {
  return <Suspense fallback={<Skeleton className="h-96" />}><Inner /></Suspense>;
}

function Inner() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { can, meta } = useSession();
  const section = (sp.get('s') as Section) || 'payment-modes';
  const admin = can('settings_admin');
  const [reset, setReset] = useState(false);

  const cols: Record<Exclude<Section, 'users' | 'preferences'>, Col[]> = useMemo(() => ({
    'payment-modes': [
      { key: 'name', label: 'Name', type: 'text' }, { key: 'code', label: 'Code', type: 'text', width: 'w-28' },
      { key: 'requires_bank', label: 'Needs bank', type: 'bool' }, { key: 'requires_reference', label: 'Needs reference', type: 'bool' },
      { key: 'requires_card', label: 'Card terminal', type: 'bool' }, { key: 'realization_required', label: 'Needs realization', type: 'bool' },
      { key: 'sort', label: 'Order', type: 'number', width: 'w-20' }, { key: 'active', label: 'Active', type: 'bool' },
    ],
    counters: [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'counter_type', label: 'Type', type: 'select', options: [{ value: 'billing', label: 'Billing' }, { value: 'pharmacy', label: 'Pharmacy' }, { value: 'system', label: 'System' }] },
      { key: 'card_terminal', label: 'Card terminal ID', type: 'text', width: 'w-36' }, { key: 'is_system', label: 'System counter', type: 'bool', readOnly: true },
      { key: 'active', label: 'Active', type: 'bool' },
    ],
    'number-series': [
      { key: 'key', label: 'Series', type: 'text', readOnly: true, width: 'w-36' }, { key: 'label', label: 'Used for', type: 'text' },
      { key: 'prefix', label: 'Prefix', type: 'text', width: 'w-24' }, { key: 'next_value', label: 'Next number', type: 'number', width: 'w-32' },
      { key: 'pad', label: 'Digits', type: 'number', width: 'w-20' },
    ],
    'discount-categories': [
      { key: 'name', label: 'Name', type: 'text' }, { key: 'percent', label: 'Percent', type: 'number', width: 'w-24' },
      { key: 'charge_groups', label: 'Applies to (empty = everything)', type: 'groups' }, { key: 'active', label: 'Active', type: 'bool' },
    ],
    'rate-plans': [
      { key: 'name', label: 'Name', type: 'text' }, { key: 'discount_pct', label: 'Discount off list rate (%)', type: 'number', width: 'w-40' },
      { key: 'active', label: 'Active', type: 'bool' },
    ],
  }), []);

  return (
    <div>
      <PageHeader title="Settings" sub={admin ? 'Changes apply straight away and are recorded in the audit trail.' : 'You can view settings. Changing them needs the “Manage settings” right.'}
        actions={admin && <Button icon={<RotateCcw className="h-4 w-4" />} onClick={() => setReset(true)}>Reset demo data</Button>} />
      <div className="panel overflow-hidden">
        <Tabs className="px-2" value={section} onChange={(v) => router.replace(`${pathname}?s=${v}`, { scroll: false })} tabs={SECTIONS.map((s) => ({ ...s }))} />
        {section === 'users' ? <UsersRights admin={admin} rights={meta?.rights || {}} />
          : section === 'preferences' ? <Preferences admin={admin} />
            : <EditableTable key={section} resource={section} cols={cols[section]} admin={admin} canAdd={section !== 'number-series'} chargeGroups={meta?.chargeGroups || []} />}
      </div>
      <ResetDialog open={reset} onClose={() => setReset(false)} />
    </div>
  );
}

/* ---------------------------------------------------------------- Generic table */
function EditableTable({ resource, cols, admin, canAdd, chargeGroups }: { resource: string; cols: Col[]; admin: boolean; canAdd: boolean; chargeGroups: string[] }) {
  const { data, error, loading, reload } = useApi<Row[]>(`/settings/${resource}`);
  const pk = resource === 'number-series' ? 'key' : 'id';
  const [drafts, setDrafts] = useState<Record<string, Row>>({});
  const [adding, setAdding] = useState<Row | null>(null);
  const { run, pending } = useMutation();
  const toast = useToast();
  const fail = useErrorToast();
  useEffect(() => setDrafts({}), [data]);

  const val = (r: Row, k: string) => (drafts[String(r[pk])]?.[k] !== undefined ? drafts[String(r[pk])]![k] : r[k]);
  const setVal = (r: Row, k: string, v: unknown) => setDrafts((d) => ({ ...d, [String(r[pk])]: { ...d[String(r[pk])], [k]: v } }));

  async function save(r: Row) {
    try { await run(`/settings/${resource}/${r[pk]}`, 'PATCH', drafts[String(r[pk])]); toast({ tone: 'success', title: 'Saved' }); reload(); } catch (e) { fail(e, 'Not saved'); }
  }
  async function create() {
    try { await run(`/settings/${resource}`, 'POST', adding); toast({ tone: 'success', title: 'Added' }); setAdding(null); reload(); } catch (e) { fail(e, 'Not added'); }
  }

  const cell = (c: Col, value: unknown, onChange: (v: unknown) => void, disabled: boolean) => {
    if (c.type === 'bool') return <Toggle checked={!!value} onChange={(v) => onChange(v ? 1 : 0)} disabled={disabled || c.readOnly} label={c.label} />;
    if (c.type === 'select') return <Select aria-label={c.label} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} disabled={disabled || c.readOnly} className="h-8 text-[length:calc(13px*var(--fs-scale,1))]">{c.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>;
    if (c.type === 'groups') {
      const arr = (value as string[]) || [];
      return (
        <div className="flex flex-wrap gap-1">
          {chargeGroups.map((g) => (
            <button key={g} type="button" aria-pressed={arr.includes(g)} disabled={disabled} onClick={() => onChange(arr.includes(g) ? arr.filter((x) => x !== g) : [...arr, g])}
              className={clsx('rounded-full border px-2 py-0.5 text-[length:calc(11.5px*var(--fs-scale,1))]', arr.includes(g) ? 'border-pine-600 bg-pine-50 text-pine-800' : 'border-line text-ink-soft')}>{GROUP_LABEL[g] || g}</button>
          ))}
        </div>
      );
    }
    return <Input aria-label={c.label} value={String(value ?? '')} onChange={(e) => onChange(c.type === 'number' ? e.target.value.replace(/[^0-9.]/g, '') : e.target.value)} disabled={disabled || c.readOnly}
      className={clsx('h-8 text-[length:calc(13px*var(--fs-scale,1))]', c.type === 'number' && 'text-end', c.width)} />;
  };

  if (error) return <div className="p-4"><ErrorNote error={error} onRetry={reload} /></div>;
  return (
    <div className="overflow-x-auto">
      <SettleTable>
        <thead><TableRow>{cols.map((c) => <th key={c.key} className={c.width}>{c.label}</th>)}<th className="w-24"><span className="sr-only">Actions</span></th></TableRow></thead>
        <tbody>
          {loading && !data ? <TableRow><td colSpan={cols.length + 1}><Skeleton className="h-24" /></td></TableRow> : data?.map((r) => {
            const dirty = !!drafts[String(r[pk])];
            return (
              <TableRow key={String(r[pk])} className={clsx(dirty && 'bg-marigold-50/50')}>
                {cols.map((c) => <td key={c.key}>{cell(c, val(r, c.key), (v) => setVal(r, c.key, c.type === 'number' ? (v === '' ? '' : Number(v)) : v), !admin)}</td>)}
                <td className="text-end">{dirty && <Button size="sm" variant="primary" icon={<Save className="h-3.5 w-3.5" />} loading={pending} onClick={() => save(r)}>Save</Button>}</td>
              </TableRow>
            );
          })}
          {adding && (
            <TableRow className="bg-pine-50/50">
              {cols.map((c) => <td key={c.key}>{c.readOnly ? null : cell(c, adding[c.key], (v) => setAdding({ ...adding, [c.key]: c.type === 'number' ? Number(v) : v }), false)}</td>)}
              <td className="whitespace-nowrap text-end"><Button size="sm" variant="ghost" onClick={() => setAdding(null)}>Cancel</Button><Button size="sm" variant="primary" loading={pending} onClick={create}>Add</Button></td>
            </TableRow>
          )}
        </tbody>
      </SettleTable>
      {admin && canAdd && !adding && (
        <div className="border-t border-line p-3"><Button size="sm" variant="quiet" icon={<Plus className="h-4 w-4" />} onClick={() => setAdding({ active: 1 })}>Add</Button></div>
      )}
      {resource === 'number-series' && <p className="border-t border-line px-4 py-3 text-[length:calc(12.5px*var(--fs-scale,1))] text-ink-mute">Next numbers can only move forward, so existing numbers are never reused.</p>}
    </div>
  );
}

/* ---------------------------------------------------------------- Users & rights */
const RIGHT_GROUPS: [string, string[]][] = [
  ['Bills and charges', ['edit_bill', 'addtobill_charges', 'cancel_elements_in_bill', 'allow_ratechange', 'allow_discount', 'allow_backdate', 'change_billtype', 'change_billprimary', 'connect_disconnect_tpa']],
  ['Lifecycle', ['bill_reopen', 'cancel_bill', 'patient_writeoff']],
  ['Money', ['allow_refund', 'allow_deposit_setoff', 'collect_deposit', 'edit_receipt', 'realize_cheques', 'close_counter']],
  ['Approvals', ['approve_discount', 'approve_writeoff', 'approve_cancellation']],
  ['Oversight', ['view_reports', 'view_audit', 'settings_admin']],
];

interface UserRow { id: number; username: string; name: string; role: string; rights: string[]; counter_id: number | null; initials: string }

function UsersRights({ admin, rights }: { admin: boolean; rights: Record<string, string> }) {
  const { data, reload } = useApi<UserRow[]>('/settings/users');
  const { meta, refresh } = useSession();
  const [sel, setSel] = useState<number | null>(null);
  const [draft, setDraft] = useState<UserRow | null>(null);
  const { run, pending } = useMutation();
  const toast = useToast();
  const fail = useErrorToast();
  useEffect(() => { if (data && sel === null) setSel(data[0]?.id ?? null); }, [data, sel]);
  useEffect(() => { const u = data?.find((x) => x.id === sel); setDraft(u ? { ...u } : null); }, [data, sel]);
  const original = data?.find((x) => x.id === sel);
  const dirty = !!draft && !!original && JSON.stringify(draft) !== JSON.stringify(original);
  const isAdminRole = draft?.role === 'admin';

  return (
    <div className="grid lg:grid-cols-[260px_1fr]">
      <ul className="border-b border-line lg:border-b-0 lg:border-e">
        {data?.map((u) => (
          <li key={u.id}>
            <button type="button" onClick={() => setSel(u.id)} className={clsx('flex w-full items-center gap-3 px-4 py-3 text-start', sel === u.id ? 'bg-pine-50' : 'hover:bg-mist/60')}>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-[length:calc(11px*var(--fs-scale,1))] font-semibold text-panel">{u.initials}</span>
              <span><span className="block text-[length:calc(14px*var(--fs-scale,1))] font-medium">{u.name}</span><span className="block text-[length:calc(12px*var(--fs-scale,1))] text-ink-mute">{roleLabel(u.role)}</span></span>
            </button>
          </li>
        ))}
      </ul>
      {draft && (
        <div className="p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Name"><Input value={draft.name} disabled={!admin} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
            <Field label="Role">
              <Select value={draft.role} disabled={!admin} onChange={(e) => setDraft({ ...draft, role: e.target.value })}>
                {['admin', 'billing', 'cashier', 'finance'].map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
              </Select>
            </Field>
            <Field label="Default counter">
              <Select value={draft.counter_id ?? ''} disabled={!admin} onChange={(e) => setDraft({ ...draft, counter_id: e.target.value ? Number(e.target.value) : null })}>
                <option value="">None</option>{meta?.counters.filter((c) => !c.is_system).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
          </div>
          {isAdminRole && <p className="mt-3 flex items-center gap-2 rounded-lg bg-pine-50 px-3 py-2 text-[length:calc(13px*var(--fs-scale,1))] text-pine-800"><ShieldCheck className="h-4 w-4" />Administrators have every right.</p>}
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {RIGHT_GROUPS.map(([g, keys]) => (
              <fieldset key={g} className="rounded-xl border border-line p-3">
                <legend className="px-1 text-[length:calc(12.5px*var(--fs-scale,1))] font-semibold text-ink-soft">{g}</legend>
                <div className="space-y-2">
                  {keys.map((k) => (
                    <Checkbox key={k} className="flex" disabled={!admin || isAdminRole} checked={isAdminRole || draft.rights.includes(k)} label={<span className="text-[length:calc(13.5px*var(--fs-scale,1))]">{rights[k] || k}</span>}
                      onChange={(v) => setDraft({ ...draft, rights: v ? [...draft.rights, k] : draft.rights.filter((x) => x !== k) })} />
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
          {admin && (
            <div className="mt-4 flex items-center justify-end gap-2">
              {dirty && <Badge tone="marigold">Unsaved changes</Badge>}
              <Button variant="ghost" disabled={!dirty} onClick={() => setDraft(original ? { ...original } : null)}>Discard</Button>
              <Button variant="primary" disabled={!dirty} loading={pending} onClick={async () => {
                try {
                  await run(`/settings/users/${draft.id}`, 'PATCH', { name: draft.name, role: draft.role, counter_id: draft.counter_id, rights: draft.rights });
                  toast({ tone: 'success', title: `Saved ${draft.name}` }); reload(); refresh();
                } catch (e) { fail(e, 'Not saved'); }
              }}>Save user</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- Preferences */
interface Pref { key: string; value: string; label: string; kind: 'text' | 'number' | 'boolean'; grp: string; help: string | null }

function Preferences({ admin }: { admin: boolean }) {
  const { data, reload } = useApi<Pref[]>('/settings/preferences');
  const { meta, refresh } = useSession();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const { run, pending } = useMutation();
  const toast = useToast();
  const fail = useErrorToast();
  const groups = useMemo(() => {
    const m = new Map<string, Pref[]>();
    for (const p of data || []) m.set(p.grp, [...(m.get(p.grp) || []), p]);
    return [...m.entries()];
  }, [data]);
  const v = (p: Pref) => draft[p.key] ?? p.value;
  const dirty = Object.keys(draft).length > 0;

  return (
    <div className="p-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map(([g, prefs]) => (
          <section key={g} className="rounded-xl border border-line">
            <h2 className="border-b border-line px-4 py-2.5 text-[length:calc(13.5px*var(--fs-scale,1))] font-semibold">{g}</h2>
            <ul className="divide-y divide-line">
              {prefs.map((p) => (
                <li key={p.key} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[length:calc(14px*var(--fs-scale,1))]">{p.label}</p>
                    {p.help && <p className="text-[length:calc(12.5px*var(--fs-scale,1))] text-ink-mute">{p.help}</p>}
                  </div>
                  {p.kind === 'boolean' ? <Toggle checked={v(p) === 'Y'} disabled={!admin} onChange={(x) => setDraft({ ...draft, [p.key]: x ? 'Y' : 'N' })} label={p.label} />
                    : p.key === 'default_rate_plan_id' ? (
                      <Select aria-label={p.label} value={v(p)} disabled={!admin} onChange={(e) => setDraft({ ...draft, [p.key]: e.target.value })} className="w-48">
                        <option value="">List rates</option>{meta?.ratePlans.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </Select>
                    ) : <Input aria-label={p.label} value={v(p)} disabled={!admin} onChange={(e) => setDraft({ ...draft, [p.key]: e.target.value })} className={clsx(p.kind === 'number' ? 'w-28 text-end' : 'w-64')} />}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      {admin && (
        <div className="sticky bottom-0 mt-4 flex justify-end gap-2 border-t border-line bg-panel pt-3">
          <Button variant="ghost" disabled={!dirty} onClick={() => setDraft({})}>Discard</Button>
          <Button variant="primary" disabled={!dirty} loading={pending} onClick={async () => {
            try { await run('/settings/preferences', 'PATCH', draft); toast({ tone: 'success', title: 'Preferences saved' }); setDraft({}); reload(); refresh(); } catch (e) { fail(e, 'Not saved'); }
          }}>Save preferences</Button>
        </div>
      )}
    </div>
  );
}

function ResetDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const fail = useErrorToast();
  const api = useSettleApi();
  const revalidateAll = useRevalidateAll();
  return (
    <Dialog open={open} onClose={onClose} title="Reset demo data?" size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>Keep my data</Button><Button variant="danger" loading={busy} onClick={async () => {
        setBusy(true);
        try { await api('/admin/reset-demo', { method: 'POST' }); revalidateAll(); toast({ tone: 'success', title: 'Demo data restored' }); onClose(); } catch (e) { fail(e); } finally { setBusy(false); }
      }}>Reset everything</Button></>}>
      <p className="text-[length:calc(14px*var(--fs-scale,1))] text-ink-soft">All bills, receipts, deposits and settings go back to the original demo set. Anything you created will be deleted.</p>
    </Dialog>
  );
}
