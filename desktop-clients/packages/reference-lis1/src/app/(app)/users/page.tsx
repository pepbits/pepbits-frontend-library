'use client';
import {DiagnosticTable,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import { useState } from 'react';
import { Pencil, Plus } from 'lucide-react';

import { useApi } from '../../../lib/hooks';
import { Badge, Button, Card, Checkbox, ErrorNote, Field, Input, Loading, Modal, PageHeader, Select } from '../../../components/ui';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


const ROLES = [
  { value: 'ADMIN', label: 'Administrator – everything' },
  { value: 'RECEPTION', label: 'Reception – patients, orders, billing' },
  { value: 'PHLEBOTOMIST', label: 'Phlebotomist – collection, accessioning' },
  { value: 'TECHNOLOGIST', label: 'Technologist – results, validation, shipping' },
  { value: 'PATHOLOGIST', label: 'Pathologist – signing, amendments, templates' },
];

export default function UsersPage() {
 const referenceT = useReferenceLocalization().t;

 const {api}=useDiagnosticClient();

  const { data, error, reload } = useApi<any[]>('/users');
  const [edit, setEdit] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!edit.username || !edit.fullName) return setErr('Username and full name are required.');
    if (!edit.id && !edit.password) return setErr('Set an initial password.');
    setBusy(true); setErr(null);
    try {
      const body = { username: edit.username, fullName: edit.fullName, role: edit.role, qualification: edit.qualification || null, signatureText: edit.signatureText || null, email: edit.email || null, active: edit.active !== false, ...(edit.password ? { password: edit.password } : {}) };
      if (edit.id) await api.put(`/users/${edit.id}`, body); else await api.post('/users', body);
      setEdit(null); reload();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader title={referenceT("Users")} subtitle={referenceT("Staff accounts and roles. Pathologists' qualification and signature text print on reports.")}
        actions={<Button variant="primary" icon={Plus} onClick={() => { setErr(null); setEdit({ role: 'TECHNOLOGIST', active: true }); }}><ReferenceText message="Add user" /></Button>} />
      <ErrorNote error={error} />
      <Card bodyClass="p-0">
        {!data ? <Loading /> : (
          <DiagnosticTable className="tbl">
            <TableHeader><TableRow><TableHead><ReferenceText message="Username" /></TableHead><TableHead><ReferenceText message="Name" /></TableHead><TableHead><ReferenceText message="Role" /></TableHead><TableHead><ReferenceText message="Qualification" /></TableHead><TableHead><ReferenceText message="Email" /></TableHead><TableHead><ReferenceText message="Status" /></TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>{data.map((u) => (
              <TableRow key={u.id} className={u.active === false ? 'opacity-55' : ''}>
                <TableCell className="font-mono text-xs">{u.username}</TableCell><TableCell className="font-medium">{u.fullName}</TableCell><TableCell>{u.role.charAt(0) + u.role.slice(1).toLowerCase()}</TableCell>
                <TableCell className="text-sm">{u.qualification || '—'}</TableCell><TableCell className="text-sm">{u.email || '—'}</TableCell>
                <TableCell><Badge value={u.active === false ? 'CANCELLED' : 'SUCCESS'} label={u.active === false ? 'Inactive' : 'Active'} /></TableCell>
                <TableCell className="text-right"><Button size="sm" variant="ghost" icon={Pencil} onClick={() => { setErr(null); setEdit({ ...u, password: '' }); }}><ReferenceText message="Edit" /></Button></TableCell>
              </TableRow>
            ))}</TableBody>
          </DiagnosticTable>
        )}
      </Card>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? `Edit ${edit.username}` : 'New user'}
        footer={<><Button onClick={() => setEdit(null)}><ReferenceText message="Cancel" /></Button><Button variant="primary" loading={busy} onClick={save}><ReferenceText message="Save" /></Button></>}>
        {edit && <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><ErrorNote error={err} /></div>
          <Field label={referenceT("Username")} required><Input value={edit.username || ''} disabled={!!edit.id} onChange={(e) => setEdit({ ...edit, username: e.target.value })} /></Field>
          <Field label={referenceT("Full name")} required><Input value={edit.fullName || ''} onChange={(e) => setEdit({ ...edit, fullName: e.target.value })} /></Field>
          <Field label={referenceT("Role")} className="col-span-2"><Select value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value })} options={ROLES} /></Field>
          <Field label={edit.id ? 'New password (leave blank to keep)' : 'Password'} required={!edit.id}><Input type="password" autoComplete="new-password" value={edit.password || ''} onChange={(e) => setEdit({ ...edit, password: e.target.value })} /></Field>
          <Field label={referenceT("Email")}><Input value={edit.email || ''} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
          <Field label={referenceT("Qualification")} hint={referenceT("e.g. MD, FRCPath")}><Input value={edit.qualification || ''} onChange={(e) => setEdit({ ...edit, qualification: e.target.value })} /></Field>
          <Field label={referenceT("Signature text")} hint={referenceT("Printed above the signature line")}><Input value={edit.signatureText || ''} onChange={(e) => setEdit({ ...edit, signatureText: e.target.value })} /></Field>
          <div className="col-span-2"><Checkbox label={referenceT("Active (can sign in)")} checked={edit.active !== false} onChange={(v) => setEdit({ ...edit, active: v })} /></div>
        </div>}
      </Modal>
    </div>
  );
}
