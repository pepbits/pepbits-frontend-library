'use client';
import { cx, useEntityApi, Button, Modal, useToast, missingRequired, RecordForm, type PageDef, type Row } from '@pepbits/reference-keystone-core';
import { useEffect, useRef, useState } from 'react';
import { Save, Trash2 } from 'lucide-react';
import { nounOf } from '../../lib/registry';
import { LocalizedText as ReferenceText } from '@pepbits/ops-ui';
import { useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';



/**
 * Small lookup masters (country, unit, shift…) are added and edited in a dialog
 * over the worklist, so people never lose their place in the list.
 */
export function QuickDialog({ def, row, defaults, open, onClose, onSaved }: { def: PageDef; row: Row | null; defaults?: Partial<Row>; open: boolean; onClose: () => void; onSaved: () => void }) {
 const referenceT = useReferenceLocalization().t;

  const entityApi = useEntityApi();
  const toast = useToast();
  const base = () => row ?? { ...(defaults ?? {}), status: def.fields.find((f) => f.key === 'status')?.options?.[0] };
  const [draft, setDraft] = useState<Partial<Row>>(base);
  const [errors, setErrors] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [added, setAdded] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const isNew = !row;
  const fields = def.fields.filter((f) => !(f.type === 'code' && isNew));

  useEffect(() => {
    if (!open) return;
    setDraft(base()); setErrors(false); setConfirm(false); setAdded(0);
    setTimeout(() => boxRef.current?.querySelector<HTMLElement>('input:not([readonly]),select,textarea')?.focus(), 30);
  }, [open, row]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (again: boolean) => {
    const miss = missingRequired(def.fields, draft);
    if (miss.length) { setErrors(true); toast(referenceT("{value0} is required", {value0: referenceT(miss[0].label)}), 'danger'); return; }
    setBusy(again ? 'again' : 'save');
    try {
      if (isNew) await entityApi.create(def.entity, draft);
      else await entityApi.update(def.entity, row.id, draft);
      onSaved();
      if (again) {
        setAdded((n) => n + 1);
        setDraft({ ...(defaults ?? {}), status: def.fields.find((f) => f.key === 'status')?.options?.[0] });
        setErrors(false);
        setTimeout(() => boxRef.current?.querySelector<HTMLElement>('input:not([readonly]),select')?.focus(), 30);
      } else {
        toast(isNew ? `${nounOf(def)} added` : 'Changes saved');
        onClose();
      }
    } catch (e) { toast((e as Error).message, 'danger'); } finally { setBusy(null); }
  };
  const remove = async () => {
    if (!row) return;
    setBusy('delete');
    await entityApi.remove(def.entity, row.id);
    toast(referenceT("{value0} deleted", {value0: nounOf(def)}));
    setBusy(null);
    onSaved();
    onClose();
  };

  const name = String(row?.name ?? row?.document ?? row?.code ?? '');
  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-2xl"
      title={isNew ? `New ${nounOf(def)}` : `Edit ${nounOf(def)}${name ? `: ${name}` : ''}`}
      footer={
        confirm ? (
          <>
            <span className="mr-auto self-center text-[length:calc(13px*var(--fs-scale))] text-danger"><ReferenceText message="Delete this" /> {nounOf(def)}<ReferenceText message="? This cannot be undone." /></span>
            <Button onClick={() => setConfirm(false)}><ReferenceText message="Keep it" /></Button>
            <Button variant="danger" icon={Trash2} loading={busy === 'delete'} onClick={remove}><ReferenceText message="Delete" /></Button>
          </>
        ) : (
          <>
            {!isNew && <Button variant="ghost" icon={Trash2} className="mr-auto !text-danger" onClick={() => setConfirm(true)}><ReferenceText message="Delete" /></Button>}
            {isNew && added > 0 && <span className="mr-auto self-center text-[length:calc(12.5px*var(--fs-scale))] text-ok">{added} <ReferenceText message="added so far" /></span>}
            <Button onClick={onClose}><ReferenceText message="Cancel" /></Button>
            {isNew && <Button loading={busy === 'again'} onClick={() => save(true)}><ReferenceText message="Save and add another" /></Button>}
            <Button variant="primary" icon={Save} loading={busy === 'save'} onClick={() => save(false)}>{isNew ? referenceT("Add") : referenceT("Save")}</Button>
          </>
        )
      }
    >
      <div
        ref={boxRef}
        className={cx('py-1')}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') { e.preventDefault(); save(false); } }}
      >
        <RecordForm fields={fields} value={draft} onChange={(k, v) => setDraft((d) => ({ ...d, [k]: v }))} columns={2} showErrors={errors} />
        <p className="mt-4 text-[length:calc(12px*var(--fs-scale))] text-ink-3"><ReferenceText message="Press Enter to save. Esc closes without saving." /></p>
      </div>
    </Modal>
  );
}
