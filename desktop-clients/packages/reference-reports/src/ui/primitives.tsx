"use client";
/*
 * Source-API bridges. The Lumen components are ported with their original call signatures
 * (Button variant/icon, SelectInput options, Checkbox onChange(boolean) …) and rendered through the
 * shared @pepbits/ops-ui primitives, so theme tokens, focus rings, localisation and form scales come
 * from the host. Layout-only wrappers use the module-scoped classes in reports.css.
 */
import React from 'react';
import {
  Badge as OpsBadge, Button as OpsButton, Card as OpsCard, CardHeader as OpsCardHeader, Checkbox as OpsCheckbox, Input, Modal as OpsModal,
  MultiSelect as OpsMultiSelect, Select, Textarea, Toggle as OpsToggle, useLocalization, type BadgeTone,
} from '@pepbits/ops-ui';
import { ReferenceLink } from '@pepbits/reference-host';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function useT() {
  return useLocalization().t;
}

// ---------------------------------------------------------------------------
// Buttons

export type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'signal';
type Size = 'sm' | 'md';
const opsVariant = (v: Variant) => (v === 'signal' ? 'outline' : v);

export function Button({ variant = 'secondary', size = 'md', loading, icon, children, className, type = 'button', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean; icon?: React.ReactNode }) {
  return <OpsButton {...rest} type={type} variant={opsVariant(variant)} size={size} loading={loading} leftIcon={icon} className={cx(variant === 'signal' && 'lr-btn-signal', className)}>{children}</OpsButton>;
}

/** next/link button replacement: host navigation through ReferenceLink. */
export function LinkButton({ href, variant = 'secondary', size = 'md', icon, children, className }: { href: string; variant?: Variant; size?: Size; icon?: React.ReactNode; children: React.ReactNode; className?: string }) {
  const t = useT();
  return <ReferenceLink href={href} className={cx('lr-link-button', `lr-link-button-${variant}`, `lr-link-button-${size}`, className)}>{icon}{typeof children === 'string' ? t(children) : children}</ReferenceLink>;
}

// ---------------------------------------------------------------------------
// Cards and page structure

export function Card({ children, className, as = 'section' }: { children: React.ReactNode; className?: string; as?: 'section' | 'div' }) {
  return <OpsCard as={as} className={cx('lr-card', className)}>{children}</OpsCard>;
}

export function CardHeader({ title, description, actions }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode }) {
  const t = useT();
  return (
    <OpsCardHeader className="lr-card-header">
      <div className="lr-grow">
        <h2 className="lr-h2">{typeof title === 'string' ? t(title) : title}</h2>
        {description && <p className="lr-card-description">{typeof description === 'string' ? t(description) : description}</p>}
      </div>
      {actions && <div className="lr-row lr-shrink0">{actions}</div>}
    </OpsCardHeader>
  );
}

export function PageHeader({ title, description, actions, children }: { title: string; description?: React.ReactNode; actions?: React.ReactNode; children?: React.ReactNode }) {
  const t = useT();
  return (
    <header className="lr-page-header">
      <div className="lr-page-header-text">
        <h1 className="lr-h1">{t(title)}</h1>
        {description && <p className="lr-page-description">{typeof description === 'string' ? t(description) : description}</p>}
        {children}
      </div>
      {actions && <div className="lr-row">{actions}</div>}
    </header>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: React.ReactNode; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  const t = useT();
  return (
    <div className="lr-empty">
      {icon && <div className="lr-empty-icon" aria-hidden>{icon}</div>}
      <p className="lr-medium">{t(title)}</p>
      {children && <p className="lr-empty-text">{typeof children === 'string' ? t(children) : children}</p>}
      {action && <div className="lr-empty-action">{action}</div>}
    </div>
  );
}

export function Notice({ tone, children, className, role }: { tone: 'warning' | 'danger' | 'success' | 'info'; children: React.ReactNode; className?: string; role?: string }) {
  return <p role={role} className={cx('lr-notice', `lr-notice-${tone}`, className)}>{children}</p>;
}

// ---------------------------------------------------------------------------
// Badges

type Tone = 'neutral' | 'brand' | 'signal' | 'danger' | 'ink';
const TONES: Record<Tone, BadgeTone> = { neutral: 'neutral', brand: 'brand', signal: 'warning', danger: 'danger', ink: 'info' };

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return <OpsBadge tone={TONES[tone]} className={className}>{children}</OpsBadge>;
}

/** Same status-to-tone rule as the source StatusBadge; the status id stays stable, its label is localisable. */
export function StatusBadge({ status }: { status: string }) {
  const tone: Tone = ['completed', 'accepted', 'sent', 'active'].includes(status) ? 'brand'
    : ['failed', 'rejected'].includes(status) ? 'danger'
    : ['running', 'queued', 'not_sent', 'paused'].includes(status) ? 'signal' : 'neutral';
  const t = useT();
  return <Badge tone={tone}><span data-status={status}>{t(status.replaceAll('_', ' '))}</span></Badge>;
}

// ---------------------------------------------------------------------------
// Form fields (source Field.tsx signatures over ops-ui controls)

type Hint = { hint?: string; error?: string | null };

export function TextInput({ label, hint, error, ...rest }: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> & { label: string } & Hint) {
  return <Input {...rest} label={label} hint={hint} error={error ?? undefined} />;
}

export function TextArea({ label, hint, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string }) {
  return <Textarea {...rest} label={label} hint={hint} rows={rest.rows ?? 3} />;
}

export function SelectInput({ label, hint, options, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string; options: { value: string; label: string }[] }) {
  // A wrapping label also contains option text. Supply the precise accessible name.
  return <Select {...rest} aria-label={rest['aria-label'] ?? label} label={label} hint={hint} options={options} placeholder="" />;
}

export function Toggle({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; disabled?: boolean }) {
  return <OpsToggle checked={checked} onChange={(v) => { if (!disabled) onChange(v); }} label={label} description={description} disabled={disabled} />;
}

export function Checkbox({ checked, onChange, label, disabled, ariaLabel }: { checked: boolean; onChange: (v: boolean) => void; label?: React.ReactNode; disabled?: boolean; ariaLabel?: string }) {
  const t = useT();
  return <OpsCheckbox checked={checked} disabled={disabled} aria-label={ariaLabel} onChange={(e) => onChange(e.target.checked)} label={typeof label === 'string' ? t(label) : label} />;
}

export function MultiSelect({ label, options, value, onChange, placeholder = 'All', disabled }: { label: string; options: string[]; value: string[]; onChange: (v: string[]) => void; placeholder?: string; disabled?: boolean }) {
  return <OpsMultiSelect label={label} options={options.map((o) => ({ value: o, label: o }))} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled} />;
}

// ---------------------------------------------------------------------------
// Modal

export function Modal({ open, onClose, title, description, children, footer, wide }: { open: boolean; onClose: () => void; title: string; description?: string; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  return (
    <OpsModal open={open} onClose={onClose} title={title} subtitle={description} size={wide ? 'md' : 'sm'} footer={footer}>
      <div className="lr-modal-body">{children}</div>
    </OpsModal>
  );
}
