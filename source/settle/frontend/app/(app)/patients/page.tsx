'use client';

import { FilePlus2, Search, UserPlus, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useShell } from '@/components/shell/AppShell';
import { Dialog, useErrorToast, useToast } from '@/components/ui/overlay';
import { Button, Empty, ErrorNote, Field, Input, Money, PageHeader, Segmented, Select, Skeleton } from '@/components/ui/primitives';
import { qs, useApi, useDebounced, useMutation } from '@/lib/api';
import { age, relative } from '@/lib/format';
import { useSession } from '@/lib/session';
import type { Patient } from '@/lib/types';

type Row = Patient & { dues: number; deposit_balance: number; active_bills: number; last_visit: string | null };

export default function PatientsPage() {
  const router = useRouter();
  const { openNewBill } = useShell();
  const { can } = useSession();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'' | 'dues' | 'deposits'>('');
  const [reg, setReg] = useState(false);
  const dq = useDebounced(q, 250);
  const { data, error, loading, reload } = useApi<Row[]>(`/patients${qs({ q: dq, filter })}`);

  return (
    <div>
      <PageHeader title="Patient accounts" sub="Deposits, dues across bills, reward points and visits — everything that belongs to the patient rather than one bill."
        actions={can('edit_bill') && <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => setReg(true)}>Register patient</Button>} />
      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="relative min-w-[220px] flex-1 md:max-w-[360px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" />
            <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, MR number or phone" className="pl-9" aria-label="Search patients" />
          </div>
          <Segmented size="sm" value={filter} onChange={setFilter} options={[{ value: '', label: 'Everyone' }, { value: 'dues', label: 'Owes money' }, { value: 'deposits', label: 'Has deposit' }]} />
          {data && <span className="ml-auto text-[12.5px] text-ink-mute">{data.length} patient{data.length === 1 ? '' : 's'}</span>}
        </div>
        {error ? <div className="p-4"><ErrorNote error={error} onRetry={reload} /></div> : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Patient</th><th className="hidden md:table-cell">Contact</th><th className="hidden lg:table-cell">Last visit</th><th className="num">Active bills</th><th className="num">Owes</th><th className="num">Deposit</th><th className="w-[120px]" /></tr></thead>
              <tbody>
                {loading && !data ? Array.from({ length: 8 }).map((_, i) => <tr key={i}><td colSpan={7}><Skeleton className="h-7" /></td></tr>) : data?.map((p) => (
                  <tr key={p.mr_no} className="row-link group" onClick={(e) => { if (!(e.target as HTMLElement).closest('button')) router.push(`/patients/${p.mr_no}`); }}>
                    <td className="min-w-[200px]">
                      <span className="font-medium">{p.name}</span>
                      <div className="text-[12px] text-ink-mute">{p.mr_no}{p.gender ? `, ${p.gender}` : ''}{age(p.dob) !== null ? ` ${age(p.dob)} y` : ''}</div>
                    </td>
                    <td className="hidden text-[13px] text-ink-soft md:table-cell">{p.phone}<div className="text-[12px] text-ink-mute">{p.city}</div></td>
                    <td className="hidden text-[13px] text-ink-soft lg:table-cell">{relative(p.last_visit)}</td>
                    <td className="num">{p.active_bills || <span className="text-ink-mute">—</span>}</td>
                    <td className="num">{p.dues > 0 ? <Money value={p.dues} tone="due" /> : <span className="text-ink-mute">—</span>}</td>
                    <td className="num">{p.deposit_balance > 0 ? <Money value={p.deposit_balance} className="font-medium text-pine-700" /> : <span className="text-ink-mute">—</span>}</td>
                    <td className="text-right">
                      {can('edit_bill') && (
                        <Button size="sm" variant="ghost" className="opacity-70 group-hover:opacity-100" icon={<FilePlus2 className="h-3.5 w-3.5" />} onClick={() => openNewBill(p.mr_no)}>New bill</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data?.length === 0 && <Empty icon={<Users className="h-5 w-5" />} title="No patients found" body="Check the spelling, or register the patient."
              action={<Button size="sm" onClick={() => setReg(true)}>Register patient</Button>} />}
          </div>
        )}
      </div>
      <RegisterDialog open={reg} onClose={() => setReg(false)} initialName={/\d/.test(q) ? '' : q} />
    </div>
  );
}

function RegisterDialog({ open, onClose, initialName }: { open: boolean; onClose: () => void; initialName: string }) {
  const router = useRouter();
  const { run, pending } = useMutation();
  const toast = useToast();
  const fail = useErrorToast();
  const [f, setF] = useState({ name: '', phone: '', gender: 'F', dob: '', city: '' });
  const ok = f.name.trim().length > 1 && f.phone.replace(/\D/g, '').length >= 8;
  return (
    <Dialog open={open} onClose={onClose} title="Register patient" size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!ok} loading={pending} onClick={async () => {
        try {
          const { data } = await run<Patient>('/patients', 'POST', { ...f, name: f.name.trim(), dob: f.dob || null, city: f.city || null });
          toast({ tone: 'success', title: `Registered ${data.name}`, body: data.mr_no });
          onClose(); router.push(`/patients/${data.mr_no}`);
        } catch (e) { fail(e, 'Not registered'); }
      }}>Register</Button></>}>
      <div className="grid grid-cols-2 gap-3" onFocus={() => { if (!f.name && initialName) setF((x) => ({ ...x, name: initialName })); }}>
        <Field label="Full name" className="col-span-2"><Input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Mobile number"><Input inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="Gender"><Select value={f.gender} onChange={(e) => setF({ ...f, gender: e.target.value })}><option value="F">Female</option><option value="M">Male</option><option value="O">Other</option></Select></Field>
        <Field label="Date of birth" optional><Input type="date" value={f.dob} onChange={(e) => setF({ ...f, dob: e.target.value })} /></Field>
        <Field label="City" optional><Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></Field>
      </div>
    </Dialog>
  );
}
