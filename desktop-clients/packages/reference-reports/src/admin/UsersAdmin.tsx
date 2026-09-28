"use client";
// Port of lumen-reports src/components/admin/UsersAdmin.tsx. Sign-in stays with the host: these are report
// directory records (roles, branches, activation). Passwords are validated for contract parity, never stored.
import { Plus } from 'lucide-react';
import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow, useLocalization } from '@pepbits/ops-ui';
import { useModuleRouter, useReportsClient } from '../api/client';
import type { PublicUser } from '../types';
import { Badge, Button, Card, Modal, MultiSelect, StatusBadge, TextInput, Toggle } from '../ui/primitives';
import { useReportFormat } from '../ui/preferences';
import { useToast } from '../ui/Toast';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


const ALL = 'All branches';

interface Form {
  id?: string;
  name: string;
  email: string;
  roles: string[];
  branches: string[];
  active: boolean;
  password: string;
}

export type DirectoryUser = PublicUser & { hostAccount?: boolean; directoryOnly?: boolean };

export function UsersAdmin({ users, roles, branches, timezone, selfId }: { users: DirectoryUser[]; roles: { id: string; name: string }[]; branches: string[]; timezone: string; selfId: string }) {
 const referenceT = useReferenceLocalization().t;

  const router = useModuleRouter();
  const { api } = useReportsClient();
  const { t } = useLocalization();
  const fmt = useReportFormat();
  const toast = useToast();
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const roleName = (id: string) => roles.find((r) => r.id === id)?.name ?? id;
  const roleId = (name: string) => roles.find((r) => r.name === name)?.id ?? name;

  const open = (u?: DirectoryUser) => setForm(u
    ? { id: u.id, name: u.name, email: u.email, roles: u.roleIds.map(roleName), branches: u.branchIds.includes('*') ? [ALL] : u.branchIds, active: u.active, password: '' }
    : { name: '', email: '', roles: [], branches: [ALL], active: true, password: '' });

  const save = async () => {
    if (!form) return;
    setBusy(true);
    const branchIds = form.branches.includes(ALL) ? ['*'] : form.branches;
    try {
      if (form.id) {
        await api(`/api/admin/users/${form.id}`, { method: 'PATCH', body: { name: form.name, roleIds: form.roles.map(roleId), branchIds, active: form.active, ...(form.password ? { password: form.password } : {}) } });
        toast.success('User updated. Changes apply on their next request.');
      } else {
        await api('/api/admin/users', { body: { name: form.name, email: form.email, roleIds: form.roles.map(roleId), branchIds, password: form.password } });
        toast.success('User created.');
      }
      setForm(null);
      router.refresh();
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="lr-mb"><Button variant="primary" icon={<Plus className="lr-icon-sm" />} onClick={() => open()}><ReferenceText message="Add user" /></Button></div>
      <Card>
        <TableContainer className="lr-table-scroll">
          <Table className="lr-table">
            <TableHeader>
              <TableRow>
                <TableHead>{t('User')}</TableHead>
                <TableHead>{t('Roles')}</TableHead>
                <TableHead>{t('Branches')}</TableHead>
                <TableHead>{t('Status')}</TableHead>
                <TableHead>{t('Last sign-in')}</TableHead>
                <TableHead><span className="lr-sr-only">{t('Actions')}</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell><p className="lr-medium">{u.name} {u.hostAccount && <Badge tone="ink"><ReferenceText message="Host account" /></Badge>}</p><p className="lr-xs lr-muted">{u.email}</p></TableCell>
                  <TableCell>{u.roleIds.map(roleName).join(', ')}</TableCell>
                  <TableCell>{u.branchIds.includes('*') ? t('All') : u.branchIds.join(', ')}</TableCell>
                  <TableCell><StatusBadge status={u.active ? 'active' : 'inactive'} /></TableCell>
                  <TableCell className="lr-nowrap lr-xs lr-muted">{fmt.dateTime(u.lastLoginAt, timezone)}</TableCell>
                  <TableCell className="lr-end"><Button size="sm" onClick={() => open(u)}><ReferenceText message="Edit" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Edit user' : 'Add user'} description={referenceT("Roles decide which reports and actions are available. Branches limit which rows the user sees in every report.")}
        footer={<><Button onClick={() => setForm(null)}><ReferenceText message="Cancel" /></Button><Button variant="primary" loading={busy} onClick={save}
          disabled={!form || form.name.trim().length < 2 || !form.roles.length || !form.branches.length || (!form.id && (!form.email || form.password.length < 10))}>{form?.id ? 'Save user' : 'Add user'}</Button></>}>
        {form && (
          <div className="lr-grid-2">
            <TextInput label={referenceT("Full name")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <TextInput label={referenceT("Work email")} type="email" value={form.email} disabled={!!form.id} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <MultiSelect label={referenceT("Roles")} options={roles.map((r) => r.name)} value={form.roles} onChange={(v) => setForm({ ...form, roles: v })} placeholder={referenceT("Choose roles")} />
            <MultiSelect label={referenceT("Branches")} options={[ALL, ...branches]} value={form.branches}
              onChange={(v) => setForm({ ...form, branches: v.includes(ALL) && !form.branches.includes(ALL) ? [ALL] : v.filter((x) => x !== ALL) })} placeholder={referenceT("Choose branches")} />
            <div className="lr-span-full">
              <TextInput label={form.id ? 'New password (optional)' : 'Temporary password'} type="password" autoComplete="new-password" value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })} hint={referenceT("At least 10 characters. Sign-in is handled by the host application; this demo directory does not store passwords.")} />
            </div>
            {form.id && form.id !== selfId && (
              <div className="lr-span-full"><Toggle checked={form.active} onChange={(v) => setForm({ ...form, active: v })} label={referenceT("Active")} description={referenceT("Inactive users cannot use reports, their schedules are skipped and email requests from them are ignored.")} /></div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
