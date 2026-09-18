'use client';
import React, { useEffect, useState } from 'react';
import { Button, Card, Input, useLocalization } from '@pepbits/ops-ui';
import { lifecycleKeyValid, type LifecycleKeyFormat } from '@pepbits/erp-config/lifecycle';
import styles from './lifecycle.module.css';

/**
 * Stable-key editor. Renames are committed on blur/Enter only, and only when the new key is
 * valid and unused, because a rename cascades to every reference: committing each keystroke
 * could merge two items' references irreversibly.
 */
export function LifecycleKeyField({ label, value, format, taken, disabled, onRename }: {
  label: string;
  value: string;
  format: LifecycleKeyFormat;
  taken: string[];
  disabled: boolean;
  onRename: (next: string) => void;
}) {
  const { t } = useLocalization(), [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const error = draft === value ? undefined : !lifecycleKeyValid(format, draft) ? t(`lifecycle.keyFormat.${format}`)
    : taken.includes(draft) ? t('lifecycle.keyTaken') : undefined;
  const commit = () => { if (draft !== value && !error) onRename(draft); };
  return <Input label={label} value={draft} disabled={disabled} error={error} hint={draft === value ? t(`lifecycle.keyFormat.${format}`) : t('lifecycle.keyCommit')}
    spellCheck={false} autoComplete="off" onChange={e => setDraft(e.target.value)} onBlur={commit}
    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } if (e.key === 'Escape') setDraft(value); }} />;
}

/**
 * Optional code (for example a lifecycle module or domain). Empty stores null; a value is stored
 * only while it matches the key format, otherwise the last valid value is kept and the error shown.
 */
export function LifecycleOptionalCodeField({ label, hint, value, format, disabled, onChange }: {
  label: string;
  hint: string;
  value: string | null | undefined;
  format: LifecycleKeyFormat;
  disabled: boolean;
  onChange: (next: string | null) => void;
}) {
  const { t } = useLocalization(), [draft, setDraft] = useState(value ?? '');
  useEffect(() => setDraft(current => (current.trim() === (value ?? '') ? current : value ?? '')), [value]);
  const trimmed = draft.trim(), error = trimmed && !lifecycleKeyValid(format, trimmed) ? t(`lifecycle.keyFormat.${format}`) : undefined;
  return <Input label={label} hint={hint} value={draft} disabled={disabled} error={error} spellCheck={false} autoComplete="off" maxLength={64}
    onChange={e => {
      const next = e.target.value, code = next.trim();
      setDraft(next);
      if (!code) { if (value != null) onChange(null); } else if (lifecycleKeyValid(format, code) && code !== value) onChange(code);
    }} />;
}

/** Comma/line separated list input for string arrays (subject types, workflow states, IN values). */
export function LifecycleListField({ label, value, disabled, hint, multiline, onChange }: {
  label: string;
  value: string[];
  disabled: boolean;
  hint?: string;
  multiline?: boolean;
  onChange: (next: string[]) => void;
}) {
  const separator = multiline ? '\n' : ', ', [text, setText] = useState(value.join(separator));
  useEffect(() => {
    setText(current => (split(current).join('\n') === value.join('\n') ? current : value.join(separator)));
  }, [value, separator]);
  function split(raw: string) { return raw.split(multiline ? /\n/ : /[,\n]/).map(v => v.trim()).filter(Boolean); }
  return <Input label={label} hint={hint} value={text} disabled={disabled} spellCheck={false}
    onChange={e => { setText(e.target.value); onChange(split(e.target.value)); }} />;
}

/** Master list + inspector used by each editor section. */
export function LifecycleItemSection<T>({ title, help, items, id, describe, selected, onSelect, onAdd, addDisabled, children }: {
  title: string;
  help: string;
  items: T[];
  id: (item: T) => string;
  describe: (item: T) => { label: string; code: string };
  selected: string | null;
  onSelect: (id: string) => void;
  onAdd?: () => void;
  addDisabled?: boolean;
  children: React.ReactNode;
}) {
  const { t } = useLocalization();
  return <div className={styles.split}>
    <Card className={styles.section} aria-label={title}>
      <p className={styles.muted}>{help}</p>
      {onAdd ? <Button size="sm" onClick={onAdd} disabled={addDisabled}>{t('lifecycle.add')}</Button> : null}
      <div className={styles.itemList}>
        {items.map(item => { const d = describe(item); return <button key={id(item)} type="button" className={styles.item}
          aria-current={selected === id(item)} onClick={() => onSelect(id(item))}><span>{d.label || t('lifecycle.unlabelled')}</span><code>{d.code}</code></button>; })}
        {!items.length ? <p className={styles.muted}>{t('lifecycle.noItems')}</p> : null}
      </div>
    </Card>
    <Card className={styles.section}>{children}</Card>
  </div>;
}

/** Removal is blocked while references exist; the references are listed instead of silently deleted. */
export function LifecycleRemove({ references, disabled, onRemove }: { references: string[]; disabled: boolean; onRemove: () => void }) {
  const { t } = useLocalization();
  return <div className={styles.actions}>
    <Button variant="danger" size="sm" disabled={disabled || references.length > 0} onClick={onRemove}>{t('lifecycle.remove')}</Button>
    {references.length ? <p className={styles.status}>{t('lifecycle.removeBlocked', { references: references.join(', ') })}</p> : null}
  </div>;
}
