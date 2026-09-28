"use client";
// Port of lumen-reports src/components/admin/ApiKeysPanel.tsx. The secret exists only in this component's
// state after creation and is never re-fetched: the store returns it once and keeps a hash.
import { Copy, KeyRound, Plus, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { ConfirmDialog, useLocalization } from '@pepbits/ops-ui';
import { useReportsClient } from '../api/client';
import type { ApiKey } from '../types';
import { Button, Card, CardHeader, EmptyState, Notice, TextInput } from '../ui/primitives';
import { useReportFormat } from '../ui/preferences';
import { useToast } from '../ui/Toast';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


type PubKey = Omit<ApiKey, 'hash'>;

export function ApiKeysPanel({ initial, canCreate, baseUrl, apiReports, timezone }: { initial: PubKey[]; canCreate: boolean; baseUrl: string; apiReports: { id: string; title: string }[]; timezone: string }) {
 const referenceT = useReferenceLocalization().t;

  const { api } = useReportsClient();
  const { t } = useLocalization();
  const fmt = useReportFormat();
  const [keys, setKeys] = useState(initial);
  const [name, setName] = useState('');
  const [secret, setSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [revoking, setRevoking] = useState<PubKey | null>(null);
  const toast = useToast();
  const create = async () => {
    setBusy(true);
    try {
      const r = await api<{ key: PubKey; secret: string }>('/api/account/keys', { body: { name } });
      setKeys([...keys, r.key]);
      setSecret(r.secret);
      setName('');
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  };
  const revoke = async (k: PubKey) => {
    setRevoking(null);
    try {
      await api(`/api/account/keys/${k.id}`, { method: 'DELETE' });
      setKeys(keys.filter((x) => x.id !== k.id));
    } catch (e) {
      toast.error(e);
    }
  };
  const sample = apiReports[0]?.id ?? 'revenue-by-service';
  return (
    <div className="lr-two-col-xl">
      <Card>
        <CardHeader title={referenceT("Your API keys")} description={referenceT("A key acts as you: same reports, branches and masking. Only reports with the API / BI action can be pulled.")} />
        {canCreate && (
          <div className="lr-row lr-row-end lr-card-bar">
            <div className="lr-grow lr-min-200"><TextInput label={referenceT("Key name")} value={name} onChange={(e) => setName(e.target.value)} placeholder={referenceT("For example: Power BI finance model")} /></div>
            <Button variant="primary" icon={<Plus className="lr-icon-sm" />} loading={busy} disabled={name.trim().length < 2} onClick={create}><ReferenceText message="Create key" /></Button>
          </div>
        )}
        {secret && (
          <div className="lr-secret">
            <p className="lr-medium lr-warn-ink">{t('Copy this key now. It will not be shown again.')}</p>
            <div className="lr-row lr-mt-sm">
              <code className="lr-code lr-grow lr-break">{secret}</code>
              <Button size="sm" icon={<Copy className="lr-icon-xs" />} onClick={() => { void navigator.clipboard?.writeText(secret).then(() => toast.success('Key copied.'), () => toast.error('Copy failed. Select the key and copy it manually.')); }}><ReferenceText message="Copy" /></Button>
            </div>
          </div>
        )}
        {keys.length === 0 ? <EmptyState icon={<KeyRound className="lr-icon-lg" />} title={referenceT("No keys yet")} /> : (
          <ul className="lr-list">
            {keys.map((k) => (
              <li key={k.id} className="lr-row lr-row-between lr-list-item">
                <div>
                  <p className="lr-medium">{k.name}</p>
                  <p className="lr-xs lr-muted"><code>{k.prefix}…</code>, {t('created {created}, last used {used}', { created: fmt.dateTime(k.createdAt, timezone), used: fmt.dateTime(k.lastUsedAt, timezone) })}</p>
                </div>
                <Button size="sm" variant="danger" icon={<Trash2 className="lr-icon-xs" />} onClick={() => setRevoking(k)}><ReferenceText message="Revoke" /></Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <ConfirmDialog open={!!revoking} tone="danger" title={referenceT("Revoke key")} confirmLabel={referenceT("Revoke")} message={t('Revoke "{name}"? Tools using it stop working immediately.', { name: revoking?.name ?? '' })}
        onConfirm={() => revoking && revoke(revoking)} onCancel={() => setRevoking(null)} />

      <Card>
        <CardHeader title={referenceT("Connect a BI tool")} description={referenceT("Tableau, Power BI, Superset, Qlik and Excel can read report data over HTTPS.")} />
        <div className="lr-stack lr-pad lr-sm">
          <Notice tone="info">{t('Demo host: these paths are served by the reference demo API behind the host session. A production deployment must publish its own authenticated BI endpoint.')}</Notice>
          <div>
            <p className="lr-medium">{t('List the reports you can pull')}</p>
            <pre className="lr-code-block">{referenceT("curl -H \"Authorization: Bearer lmn_…\" \\\n  {value0}/api/v1/reports", {value0: baseUrl})}</pre>
          </div>
          <div>
            <p className="lr-medium">{t('Pull data as CSV or JSON')}</p>
            <pre className="lr-code-block">{referenceT("{value0}/api/v1/reports/{value1}?period=last_month&format=csv\n{value2}/api/v1/reports/{value3}?from=2025-01-01&to=2025-03-31&branch=Chennai,Kochi&page=1", {value0: baseUrl, value1: sample, value2: baseUrl, value3: sample})}</pre>
          </div>
          <ul className="lr-bullets">
            <li>{t('Power BI and Excel: Get data, From Web, Advanced. Paste the URL and add an HTTP header named Authorization with the value Bearer and your key.')}</li>
            <li>{t('Tableau: use the Web Data Connector or a scheduled extract script that saves the CSV URL.')}</li>
            <li>{t('Superset and Metabase: load the JSON endpoint into your warehouse on a schedule and model it there.')}</li>
            <li>{t('Periods longer than the on-screen limit are refused. Use a schedule for bulk extracts.')}</li>
          </ul>
          <p className="lr-xs lr-muted">{t('Reports you can pull:')} {apiReports.length ? apiReports.map((r) => r.title).join(', ') : t('none yet. Ask an administrator for the API / BI action.')}</p>
        </div>
      </Card>
    </div>
  );
}
