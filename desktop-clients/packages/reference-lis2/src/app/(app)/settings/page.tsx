'use client';
import {DiagnosticDateInput} from '@pepbits/reference-diagnostics';

import {DiagnosticInput} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import { useEffect, useState } from 'react';

import { useFilters, useList, useResource } from '../../../lib/hooks';
import {titleCase} from '../../../lib/format';
import { Button, ErrorBanner, Field, Input, Loading, PageHeader, Section, Tabs, useToast } from '../../../components/ui';
import { FilterBar, FilterItem, PagedTable, SearchBox } from '../../../components/table';
import { can, useUser } from '../../../components/shell';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


const LABELS: Record<string, string> = {
  'lab.name': 'Laboratory name', 'lab.address': 'Address', 'lab.phone': 'Phone', 'lab.accreditation': 'Accreditation statement',
  'lab.hl7_app': 'HL7 sending application (MSH-3)', 'lab.hl7_facility': 'HL7 sending facility (MSH-4)',
};

export default function SettingsPage() {
 const referenceT = useReferenceLocalization().t;

 const {put}=useDiagnosticClient();
 const {fmtDateTime}=useDiagnosticFormat();

  const user = useUser();
  const toast = useToast();
  const [tab, setTab] = useState<'lab' | 'audit'>('lab');
  const { data, error, reload } = useResource<Record<string, string>>('/masters/settings/all');
  const [v, setV] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setV(data); }, [data]);
  const [f, set] = useFilters({ q: '', entity: '', action: '', from: '', to: '', pageSize: 50 });
  const audit = useList(tab === 'audit' ? '/audit' : null, f);
  if (error) return <ErrorBanner error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  return (
    <>
      <PageHeader title={referenceT("Settings and audit")} subtitle={referenceT("Laboratory identity used on reports and in outgoing messages, and the audit trail of every change.")} />
      <Tabs className="mb-4" value={tab} onChange={setTab} tabs={[{ value: 'lab', label: 'Laboratory' }, ...(can(user, 'PATHOLOGIST') ? [{ value: 'audit' as const, label: 'Audit trail' }] : [])]} />
      {tab === 'lab' && (
        <Section title={referenceT("Laboratory")} actions={can(user) && <Button variant="primary" loading={busy} onClick={async () => { setBusy(true); try { await put('/masters/settings/all', v); toast.ok('Settings saved.'); reload(); } catch (e: any) { toast.error(e.message); } finally { setBusy(false); } }}><ReferenceText message="Save settings" /></Button>}>
          <div className="grid max-w-3xl gap-3 sm:grid-cols-2">
            {Object.keys({ ...LABELS, ...v }).map((k) => (
              <Field key={k} label={LABELS[k] || k}><Input value={v[k] || ''} disabled={!can(user)} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></Field>
            ))}
          </div>
          {!can(user) && <p className="mt-3 text-sm text-ink-soft"><ReferenceText message="Only administrators can change these settings." /></p>}
        </Section>
      )}
      {tab === 'audit' && (
        <div className="panel">
          <FilterBar>
            <SearchBox className="w-64" value={f.q} onChange={(q) => set({ q })} placeholder={referenceT("Search details")} />
            <FilterItem label={referenceT("Entity")}><Input className="w-40" value={f.entity} onChange={(e) => set({ entity: e.target.value })} placeholder={referenceT("e.g. order_items")} /></FilterItem>
            <FilterItem label={referenceT("Action")}><Input className="w-36" value={f.action} onChange={(e) => set({ action: e.target.value.toUpperCase() })} placeholder={referenceT("e.g. SIGN")} /></FilterItem>
            <FilterItem label={referenceT("From")}><DiagnosticDateInput  className="input w-36" value={f.from} onChange={(e) => set({ from: e.target.value })} /></FilterItem>
            <FilterItem label={referenceT("To")}><DiagnosticDateInput  className="input w-36" value={f.to} onChange={(e) => set({ to: e.target.value })} /></FilterItem>
          </FilterBar>
          <PagedTable result={audit.data} loading={audit.loading} page={f.page} pageSize={f.pageSize} onPage={(page) => set({ page })} dense empty="No audit entries" columns={[
            { key: 'at', header: 'When', render: (r: any) => fmtDateTime(r.at) }, { key: 'user', header: 'User', render: (r: any) => r.user || 'System / interface' },
            { key: 'action', header: 'Action', render: (r: any) => titleCase(r.action) }, { key: 'entity', header: 'Record', render: (r: any) => `${r.entity || ''}${r.entity_id ? ` #${r.entity_id}` : ''}` },
            { key: 'details', header: 'Details', render: (r: any) => <span className="block max-w-[520px] truncate font-mono text-2xs text-ink-soft" title={r.details}>{r.details}</span> },
          ]} />
        </div>
      )}
    </>
  );
}
