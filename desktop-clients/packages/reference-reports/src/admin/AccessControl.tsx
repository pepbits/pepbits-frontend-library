"use client";
// Port of lumen-reports src/components/admin/AccessControl.tsx. UI locks are presentation only; the demo
// store enforces admin.access and the Administrator-role rules on every write.
import { Lock, Plus, Trash2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { Checkbox as OpsCheckbox, ConfirmDialog, SearchInput, Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow, useLocalization } from '@pepbits/ops-ui';
import { useModuleRouter, useReportsClient } from '../api/client';
import { ACTION_LABELS, ACTIONS, PERMISSION_LABELS, PERMISSIONS, type Action, type Grant, type Permission, type Role } from '../types';
import { Badge, Button, Card, CardHeader, Checkbox, Modal, TextInput } from '../ui/primitives';
import { useToast } from '../ui/Toast';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export interface AccessReport {
  id: string;
  title: string;
  category: string;
  kind: 'system' | 'custom';
  sensitive: boolean;
}

export function AccessControl({ roles, grants, reports, userCounts }: { roles: Role[]; grants: Grant[]; reports: AccessReport[]; userCounts: Record<string, number> }) {
 const referenceT = useReferenceLocalization().t;

  const router = useModuleRouter();
  const { api } = useReportsClient();
  const { t } = useLocalization();
  const toast = useToast();
  const [roleId, setRoleId] = useState(roles.find((r) => r.id !== 'admin')?.id ?? roles[0].id);
  const role = roles.find((r) => r.id === roleId) ?? roles[0];
  const initial = useMemo(() => Object.fromEntries(grants.filter((g) => g.roleId === role.id).map((g) => [g.reportId, g.actions])) as Record<string, Action[]>, [grants, role.id]);
  const [matrix, setMatrix] = useState<Record<string, Action[]>>(initial);
  const [perms, setPerms] = useState<Permission[]>(role.permissions);
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description);
  const [q, setQ] = useState('');
  const [saving, setSaving] = useState(false);
  const [newRole, setNewRole] = useState(false);
  const [newName, setNewName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const locked = role.id === 'admin';

  const selectRole = (id: string) => {
    const r = roles.find((x) => x.id === id)!;
    setRoleId(id);
    setMatrix(Object.fromEntries(grants.filter((g) => g.roleId === id).map((g) => [g.reportId, g.actions])));
    setPerms(r.permissions);
    setName(r.name);
    setDescription(r.description);
  };

  const has = (rid: string, a: Action) => locked || (matrix[rid] ?? []).includes(a);
  const set = (rid: string, a: Action, on: boolean) => {
    if (locked) return;
    setMatrix((m) => {
      let cur = new Set(m[rid] ?? []);
      if (on) {
        cur.add(a);
        cur.add('view'); // every other action requires view
      } else if (a === 'view') cur = new Set();
      else cur.delete(a);
      return { ...m, [rid]: ACTIONS.filter((x) => cur.has(x)) };
    });
  };
  const setRow = (rid: string, on: boolean) => { if (!locked) setMatrix((m) => ({ ...m, [rid]: on ? [...ACTIONS] : [] })); };
  const setColumn = (ids: string[], a: Action, on: boolean) => ids.forEach((id) => set(id, a, on));

  const filtered = reports.filter((r) => `${r.title} ${r.category} ${r.id}`.toLowerCase().includes(q.toLowerCase()));
  const groups = [...new Set(filtered.map((r) => r.category))].map((c) => ({ c, list: filtered.filter((r) => r.category === c) }));
  const dirty = JSON.stringify(initial) !== JSON.stringify(Object.fromEntries(Object.entries(matrix).filter(([, v]) => v.length)))
    || JSON.stringify([...perms].sort()) !== JSON.stringify([...role.permissions].sort()) || name !== role.name || description !== role.description;

  const save = async () => {
    setSaving(true);
    try {
      await api('/api/admin/roles', { method: 'PUT', body: { id: role.id, name, description, permissions: perms } });
      await api('/api/admin/grants', { method: 'PUT', body: { roleId: role.id, grants: Object.entries(matrix).map(([reportId, actions]) => ({ reportId, actions })) } });
      toast.success(t('Saved access for {name}. It applies on the next request, including schedules and the API.', { name }));
      router.refresh();
    } catch (e) {
      toast.error(e);
    } finally {
      setSaving(false);
    }
  };
  const createRole = async () => {
    try {
      const r = await api<Role>('/api/admin/roles', { method: 'PUT', body: { name: newName, description: '', permissions: [] } });
      setNewRole(false);
      setNewName('');
      router.refresh();
      toast.success(t('Role {name} created. Give it report access below.', { name: r.name }));
    } catch (e) {
      toast.error(e);
    }
  };
  const deleteRole = async () => {
    setConfirmDelete(false);
    try {
      await api(`/api/admin/roles?id=${encodeURIComponent(role.id)}`, { method: 'DELETE' });
      toast.success('Role deleted.');
      selectRole(roles.find((r) => r.id !== role.id)!.id);
      router.refresh();
    } catch (e) {
      toast.error(e);
    }
  };

  return (
    <div className="lr-split-access">
      <div>
        <Card as="div">
          <ul className="lr-list">
            {roles.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => selectRole(r.id)} className={`lr-role-button${r.id === role.id ? ' lr-role-button-active' : ''}`} aria-current={r.id === role.id}>
                  <span>{r.name}</span>
                  <span className="lr-num lr-xs lr-muted">{t('{count} users', { count: userCounts[r.id] ?? 0 })}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
        <Button className="lr-mt lr-full" icon={<Plus className="lr-icon-sm" />} onClick={() => setNewRole(true)}><ReferenceText message="New role" /></Button>
      </div>

      <div className="lr-stack lr-grow">
        <Card>
          <CardHeader title={referenceT("Role details and permissions")} description={referenceT("Permissions control features. Report access below controls which reports and actions the role may use.")}
            actions={!role.system && <Button size="sm" variant="danger" icon={<Trash2 className="lr-icon-xs" />} onClick={() => setConfirmDelete(true)}><ReferenceText message="Delete role" /></Button>} />
          <div className="lr-grid-2 lr-pad">
            <TextInput label={referenceT("Role name")} value={name} disabled={locked} onChange={(e) => setName(e.target.value)} />
            <TextInput label={referenceT("Description")} value={description} disabled={locked} onChange={(e) => setDescription(e.target.value)} />
            <div className="lr-grid-2 lr-span-full lr-gap-sm">
              {PERMISSIONS.map((p) => (
                <Checkbox key={p} checked={locked || perms.includes(p)} disabled={locked} onChange={(on) => setPerms(on ? [...perms, p] : perms.filter((x) => x !== p))}
                  label={<span>{t(PERMISSION_LABELS[p])}{p === 'data.unmask' && <span className="lr-xs lr-warn-ink"> ({t('patient identifiers')})</span>}</span>} />
              ))}
            </div>
          </div>
          {locked && <p className="lr-card-footnote">{t('Administrators always have every permission and every report. Assign this role sparingly.')}</p>}
        </Card>

        <Card>
          <CardHeader title={t('Report access for {name}', { name: role.name })} description={referenceT("Tick the actions this role may take on each report. Removing View removes everything else. Branch limits are set per user.")}
            actions={<Button variant="primary" loading={saving} disabled={!dirty || locked} onClick={save}><ReferenceText message="Save access" /></Button>} />
          <div className="lr-card-bar">
            <SearchInput value={q} onChange={setQ} placeholder={referenceT("Filter reports")} aria-label={referenceT("Filter reports")} />
          </div>
          <TableContainer className="lr-table-scroll lr-table-scroll-tall">
            <Table className="lr-table lr-access-matrix">
              <TableHeader>
                <TableRow>
                  <TableHead>{t('Report')}</TableHead>
                  {ACTIONS.map((a) => <TableHead key={a} className="lr-center lr-xs">{t(ACTION_LABELS[a])}</TableHead>)}
                  <TableHead className="lr-center lr-xs">{t('All')}</TableHead>
                </TableRow>
              </TableHeader>
              {groups.map(({ c, list }) => (
                <TableBody key={c}>
                  <TableRow className="lr-group-row">
                    <TableHead scope="rowgroup" className="lr-xs">{c}</TableHead>
                    {ACTIONS.map((a) => (
                      <TableCell key={a} className="lr-center">
                        <OpsCheckbox aria-label={t('{action} for all {category} reports', { action: t(ACTION_LABELS[a]), category: c })} disabled={locked}
                          checked={list.every((r) => has(r.id, a))} onChange={(e) => setColumn(list.map((r) => r.id), a, e.target.checked)} />
                      </TableCell>
                    ))}
                    <TableCell />
                  </TableRow>
                  {list.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <span className="lr-row lr-gap-xs lr-nowrap">
                          {r.title}
                          {r.kind === 'custom' && <Badge tone="brand"><ReferenceText message="Custom" /></Badge>}
                          {r.sensitive && <span title={t('Has sensitive columns: masked unless the role may see patient identifiers')}><Lock className="lr-icon-xs lr-warn-ink" aria-label={t('Has sensitive columns')} /></span>}
                        </span>
                      </TableCell>
                      {ACTIONS.map((a) => (
                        <TableCell key={a} className="lr-center">
                          <OpsCheckbox aria-label={referenceT("{value0}: {value1}", {value0: t(ACTION_LABELS[a]), value1: r.title})} disabled={locked} checked={has(r.id, a)} onChange={(e) => set(r.id, a, e.target.checked)} />
                        </TableCell>
                      ))}
                      <TableCell className="lr-center">
                        <OpsCheckbox aria-label={t('All actions: {title}', { title: r.title })} disabled={locked} checked={ACTIONS.every((a) => has(r.id, a))} onChange={(e) => setRow(r.id, e.target.checked)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              ))}
            </Table>
          </TableContainer>
        </Card>
      </div>

      <ConfirmDialog open={confirmDelete} tone="danger" title={referenceT("Delete role")} confirmLabel={referenceT("Delete")} message={t('Delete the role {name}? Its report access and role views are removed.', { name: role.name })}
        onConfirm={deleteRole} onCancel={() => setConfirmDelete(false)} />
      <Modal open={newRole} onClose={() => setNewRole(false)} title={referenceT("New role")} footer={<><Button onClick={() => setNewRole(false)}><ReferenceText message="Cancel" /></Button><Button variant="primary" disabled={newName.trim().length < 2} onClick={createRole}><ReferenceText message="Create role" /></Button></>}>
        <TextInput label={referenceT("Role name")} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={referenceT("For example: Revenue cycle lead")} />
      </Modal>
    </div>
  );
}
