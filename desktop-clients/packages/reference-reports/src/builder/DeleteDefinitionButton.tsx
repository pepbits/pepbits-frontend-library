"use client";
// Port of lumen-reports src/components/builder/DeleteDefinitionButton.tsx (window.confirm replaced by the shared ConfirmDialog).
import { Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { ConfirmDialog, useLocalization } from '@pepbits/ops-ui';
import { useModuleRouter, useReportsClient } from '../api/client';
import { Button } from '../ui/primitives';
import { useToast } from '../ui/Toast';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export function DeleteDefinitionButton({ id, title }: { id: string; title: string }) {
 const referenceT = useReferenceLocalization().t;

  const { api } = useReportsClient();
  const { t } = useLocalization();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const router = useModuleRouter();
  const toast = useToast();
  const remove = async () => {
    setConfirming(false);
    setBusy(true);
    try {
      await api(`/api/definitions/${id}`, { method: 'DELETE' });
      toast.success('Report deleted.');
      router.refresh();
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button size="sm" variant="danger" loading={busy} icon={<Trash2 className="lr-icon-xs" />} onClick={() => setConfirming(true)}><ReferenceText message="Delete" /></Button>
      <ConfirmDialog open={confirming} tone="danger" title={referenceT("Delete report")} confirmLabel={referenceT("Delete")}
        message={t('Delete "{title}"? Saved views and favorites for it are removed and its schedules are paused.', { title })}
        onConfirm={remove} onCancel={() => setConfirming(false)} />
    </>
  );
}
