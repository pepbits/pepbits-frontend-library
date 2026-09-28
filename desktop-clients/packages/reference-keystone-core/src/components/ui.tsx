'use client';
/*
 * Source-compatible primitive API (Keystone `components/ui.tsx`) implemented as thin
 * adapters over @pepbits/ops-ui. Call sites keep the source prop shapes; rendering,
 * focus handling, localization and preference-driven sizing come from the shared
 * primitives. Only behaviour without a shared equivalent keeps source markup:
 * Popover/MenuItem (render-prop anchored menu), Stepper, Spinner, Kbd, Progress, Label
 * and the scoped toast queue (no shared toast exists; duration/limit follow host prefs).
 */
import { Children, Fragment, createContext, isValidElement, useCallback, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type ComponentProps, type CSSProperties, type InputHTMLAttributes, type ReactElement, type ReactNode, type Ref, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Check, CircleAlert, CircleCheck, FileText, Info, LoaderCircle, Upload, X, type LucideIcon } from 'lucide-react';
import {
  Avatar as SharedAvatar, DateInput as SharedDateInput, DateTimeInput as SharedDateTimeInput, MonthInput as SharedMonthInput, TimeInput as SharedTimeInput, WeekInput as SharedWeekInput, Badge as SharedBadge, Button as SharedButton, Card as SharedCard, Checkbox as SharedCheckbox,
  Drawer as SharedDrawer, EmptyState, ErrorState, IconButton as SharedIconButton, Input as SharedInput, Modal as SharedModal,
  Segmented as SharedSegmented, Select as SharedSelect, Skeleton as SharedSkeleton, Tabs as SharedTabs, Textarea as SharedTextarea,
  Toggle as SharedToggle, FilePicker, PresentationProvider, Table as SharedTable, type BadgeTone, type ButtonVariant, type Option,
} from '@pepbits/ops-ui';
import { useReferenceHost } from '@pepbits/reference-host';
import { cx, statusTone, type Tone } from '../lib/format';
import { useClickOutside } from '../lib/client';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


/* ───────── Buttons ───────── */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
const VARIANTS: Record<Variant, ButtonVariant> = { primary: 'primary', secondary: 'secondary', ghost: 'ghost', danger: 'danger', subtle: 'outline' };

export function Button({ variant = 'secondary', size = 'md', icon: I, iconRight: IR, loading, className, children, type = 'button', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; icon?: LucideIcon; iconRight?: LucideIcon; loading?: boolean }) {
  return (
    <SharedButton
      {...rest}
      type={type}
      variant={VARIANTS[variant]}
      size={size === 'sm' ? 'xs' : 'sm'}
      loading={loading}
      className={cx('whitespace-nowrap', className)}
      leftIcon={I ? <I size={size === 'sm' ? 14 : 15} strokeWidth={1.9} aria-hidden /> : undefined}
      rightIcon={IR ? <IR size={14} strokeWidth={1.9} aria-hidden /> : undefined}
    >
      {children}
    </SharedButton>
  );
}

export function IconButton({ icon: I, label, active, className, size = 'md', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string; active?: boolean; size?: 'sm' | 'md' }) {
  return (
    <SharedIconButton {...rest} label={label} aria-pressed={active === undefined ? undefined : active} className={cx(size === 'sm' ? 'size-7' : 'size-8', active && 'bg-brand-soft text-brand-ink', className)}>
      <I size={size === 'sm' ? 15 : 17} strokeWidth={1.8} aria-hidden />
    </SharedIconButton>
  );
}

/* ───────── Inputs ─────────
 * Source call sites put control-level classes (h-7, pl-8, text-right, tnum…) on the
 * control, while the shared fields apply `className` to their outer wrapper. Control
 * sizing is translated to an inline style on the control; layout classes stay on the
 * wrapper. Font sizes are not translated so the host form scale still applies. */
const SPACE = (n: string) => `${Number(n) * 0.25}rem`;
export function splitFieldClasses(className?: string): { wrapper: string; style: CSSProperties } {
  const style: CSSProperties = {};
  const keep: string[] = [];
  for (const c of (className ?? '').split(/\s+/).filter(Boolean)) {
    let m: RegExpMatchArray | null;
    if ((m = c.match(/^h-(\d+(?:\.\d+)?)$/))) style.height = SPACE(m[1]);
    else if ((m = c.match(/^min-h-\[(\d+px)\]$/))) style.minHeight = m[1];
    else if ((m = c.match(/^p([lrxy])-(\d+(?:\.\d+)?)$/))) {
      const v = SPACE(m[2]);
      if (m[1] === 'l' || m[1] === 'x') style.paddingInlineStart = v;
      if (m[1] === 'r' || m[1] === 'x') style.paddingInlineEnd = v;
      if (m[1] === 'y') { style.paddingTop = v; style.paddingBottom = v; }
    }
    else if ((m = c.match(/^text-(right|center|left)$/))) style.textAlign = m[1] as CSSProperties['textAlign'];
    else if (c === 'tnum') style.fontVariantNumeric = 'tabular-nums';
    else if (c === 'font-mono') style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, monospace';
    else if ((m = c.match(/^text-\[length:calc\((\d+(?:\.\d+)?)px\*var\(--fs-scale\)\)\]$/))) style.fontSize = `calc(${m[1]}px * var(--fs-form))`;
    else if (/^text-\[\d+(?:\.\d+)?px\]$/.test(c)) continue;
    else keep.push(c);
  }
  return { wrapper: keep.join(' '), style };
}

type SourceInputProps = InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement>; invalid?: boolean };
type SharedFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix' | 'type'>;
/** Source Input props → shared field props (class split, invalid → aria-invalid, style merge). */
function sharedFieldProps({ className, ref, invalid, style, ...rest }: SourceInputProps): SharedFieldProps & { className: string } {
  const { wrapper, style: control } = splitFieldClasses(className);
  const props = { ...rest, ref, style: { ...control, ...style }, 'aria-invalid': invalid || rest['aria-invalid'] ? true : undefined };
  return { ...(props as SharedFieldProps), className: cx(/(^|\s)w-/.test(wrapper) ? '' : 'w-full', invalid && 'reference-invalid', wrapper) };
}
const DATE_TYPES = { date: SharedDateInput, time: SharedTimeInput, month: SharedMonthInput, 'datetime-local': SharedDateTimeInput, week: SharedWeekInput } as const;
export function Input({ type, ...props }: SourceInputProps) {
  const Dated = type ? DATE_TYPES[type as keyof typeof DATE_TYPES] : undefined;
  if (Dated) return <Dated {...sharedFieldProps(props)} />;
  return <SharedInput {...sharedFieldProps(props)} type={type} />;
}
/* Date/time adapters with the source Input API; values stay ISO (native control contract). */
export function DateInput({ type: _type, ...props }: SourceInputProps) { return <SharedDateInput {...sharedFieldProps(props)} />; }
export function TimeInput({ type: _type, ...props }: SourceInputProps) { return <SharedTimeInput {...sharedFieldProps(props)} />; }
export function MonthInput({ type: _type, ...props }: SourceInputProps) { return <SharedMonthInput {...sharedFieldProps(props)} />; }
export function DateTimeInput({ type: _type, ...props }: SourceInputProps) { return <SharedDateTimeInput {...sharedFieldProps(props)} />; }

type OptionElementProps = { value?: string | number; children?: ReactNode; disabled?: boolean };
const textOf = (node: ReactNode): string => {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement<{ children?: ReactNode; message?: string }>(node)) return typeof node.props.message === 'string' ? node.props.message : textOf(node.props.children);
  return '';
};
/** Flattens source `<option>` children (including fragments, arrays and optgroups) into shared options. */
export function optionsFromChildren(children: ReactNode): { options: Option[]; placeholder: string } {
  const options: Option[] = [];
  let placeholder = '';
  const walk = (nodes: ReactNode) => Children.forEach(nodes, (child) => {
    if (!isValidElement(child)) return;
    const el = child as ReactElement<OptionElementProps>;
    if (el.type === Fragment || el.type === 'optgroup') { walk(el.props.children); return; }
    if (el.type !== 'option') return;
    const label = textOf(el.props.children);
    const value = el.props.value === undefined ? label : String(el.props.value);
    if (value === '' && !options.length && !placeholder) { placeholder = label || ' '; return; }
    options.push({ value, label });
  });
  walk(children);
  return { options, placeholder };
}
export function Select({ className, children, style, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  const { options, placeholder } = optionsFromChildren(children);
  const { wrapper, style: control } = splitFieldClasses(className);
  return <SharedSelect {...rest} style={{ ...control, ...style }} options={options} placeholder={placeholder} className={cx(/(^|\s)w-/.test(wrapper) ? '' : 'w-full', wrapper)} />;
}
export function Textarea({ className, style, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { wrapper, style: control } = splitFieldClasses(className);
  return <SharedTextarea {...rest} style={{ ...control, ...style }} className={wrapper} />;
}
export function Checkbox({ checked, onChange, label, indeterminate, className, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; indeterminate?: boolean; className?: string; disabled?: boolean }) {
  return (
    // The wrapper only stops row-click propagation, as the source checkbox did inside selectable rows.
    <span className={cx('inline-flex items-center', className)} onClick={(e) => e.stopPropagation()}>
      <SharedCheckbox checked={checked} indeterminate={indeterminate} disabled={disabled} label={label} aria-label={label ? undefined : 'Select'} onChange={(e) => onChange(e.target.checked)} />
    </span>
  );
}
export function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <SharedToggle
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      label={label ?? 'Toggle'}
      className="inline-flex min-h-0 gap-0 rounded-none border-0 bg-transparent p-0 [&>span]:sr-only"
    />
  );
}
export function Label({ children, required, htmlFor }: { children: ReactNode; required?: boolean; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-[length:calc(12px*var(--fs-scale))] font-medium text-ink-2">
      {children}
      {required && <span className="text-danger"> *</span>}
    </label>
  );
}

/* ───────── Badges & avatars ───────── */
const TONES: Record<Tone, BadgeTone> = { ok: 'success', warn: 'warning', danger: 'danger', info: 'info', neutral: 'neutral', brand: 'brand', violet: 'violet' };
export function Badge({ tone = 'neutral', children, dot, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <SharedBadge tone={TONES[tone]} className={className}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {typeof children === 'string' ? <ReferenceText message={children} /> : children}
    </SharedBadge>
  );
}
/** Uses the source status vocabulary (richer than the shared default) for tone selection. */
export function StatusBadge({ value }: { value: unknown }) {
  if (value === undefined || value === null || value === '') return <span className="text-ink-3">—</span>;
  return <Badge tone={statusTone(value)} dot>{String(value)}</Badge>;
}
export function Avatar({ name, size = 28, className }: { name: unknown; size?: number; className?: string }) {
  const key = size <= 24 ? 'xs' : size <= 30 ? 'sm' : size <= 40 ? 'md' : 'lg';
  return <SharedAvatar name={String(name ?? '')} size={key} className={className} />;
}

/* ───────── Overlays ───────── */
/**
 * Record preview panel. Placement follows the host `previewMode` preference:
 * left/right drawer, or a centred dialog for center-card / center-modal. `inline`
 * keeps the right drawer because the source templates have no inline preview pane.
 */
export function Drawer({ open, onClose, title, subtitle, width = 'md', footer, children, headerExtra }: { open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; width?: 'sm' | 'md' | 'lg' | 'xl'; footer?: ReactNode; children: ReactNode; headerExtra?: ReactNode }) {
  const { preferences } = useReferenceHost();
  const plainTitle = typeof title === 'string' ? title : '';
  const plainSubtitle = typeof subtitle === 'string' ? subtitle : undefined;
  const body = (
    <>
      {(headerExtra || (title && !plainTitle) || (subtitle && !plainSubtitle)) && (
        <div className="flex items-start gap-3 border-b border-line px-5 py-2">
          <div className="min-w-0 flex-1">{!plainTitle && title}{!plainSubtitle && subtitle}</div>
          {headerExtra}
        </div>
      )}
      <div className={cx('px-5 py-4', width === 'xl' && 'reference-drawer-wide')}>{children}</div>
    </>
  );
  const mode = preferences.previewMode;
  if (mode === 'center-card' || mode === 'center-modal') {
    const size = width === 'sm' ? 'sm' : width === 'md' ? 'md' : width === 'lg' ? 'lg' : 'xl';
    return <SharedModal open={open} onClose={onClose} title={plainTitle} subtitle={plainSubtitle} size={size} footer={footer}>{body}</SharedModal>;
  }
  return (
    <SharedDrawer open={open} onClose={onClose} title={plainTitle} subtitle={plainSubtitle} side={mode === 'left-drawer' ? 'left' : 'right'} width={width === 'xl' ? 'lg' : width} footer={footer}>
      {body}
    </SharedDrawer>
  );
}

const MODAL_SIZES: [RegExp, 'sm' | 'md' | 'lg' | 'xl'][] = [[/max-w-(sm|md)\b/, 'sm'], [/max-w-(lg|xl|2xl)\b/, 'md'], [/max-w-(3xl|4xl)\b/, 'lg'], [/max-w-/, 'xl']];
export function Modal({ open, onClose, title, children, footer, width = 'max-w-md' }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; width?: string }) {
  const size = MODAL_SIZES.find(([re]) => re.test(width))?.[1] ?? 'sm';
  return (
    <SharedModal open={open} onClose={onClose} title={typeof title === 'string' ? title : ''} size={size} footer={footer}>
      {typeof title !== 'string' && <div className="px-4 pt-3 text-[length:calc(14px*var(--fs-scale))] font-semibold">{title}</div>}
      <div className="px-4 py-3">{children}</div>
    </SharedModal>
  );
}

/** Lightweight dropdown panel anchored under a trigger (source render-prop API; no shared equivalent). */
export function Popover({ trigger, children, align = 'left', width = 'w-56', open, onOpenChange }: { trigger: (toggle: () => void, open: boolean) => ReactNode; children: ReactNode | ((close: () => void) => ReactNode); align?: 'left' | 'right'; width?: string; open?: boolean; onOpenChange?: (o: boolean) => void }) {
  const [inner, setInner] = useState(false);
  const isOpen = open ?? inner;
  const set = useCallback((o: boolean) => { setInner(o); onOpenChange?.(o); }, [onOpenChange]);
  const close = useCallback(() => set(false), [set]);
  const ref = useClickOutside<HTMLDivElement>(close, isOpen);
  return (
    <div ref={ref} className="relative" onKeyDown={(e) => { if (isOpen && e.key === 'Escape') { e.stopPropagation(); close(); } }}>
      {trigger(() => set(!isOpen), isOpen)}
      {isOpen && (
        <div className={cx('absolute top-full z-40 mt-1 rounded-lg border border-line bg-surface p-1 shadow-pop anim-pop', align === 'right' ? 'right-0' : 'left-0', width)}>
          {typeof children === 'function' ? children(close) : children}
        </div>
      )}
    </div>
  );
}
export function MenuItem({ icon: I, children, onClick, danger, active, hint }: { icon?: LucideIcon; children: ReactNode; onClick?: () => void; danger?: boolean; active?: boolean; hint?: ReactNode }) {
  return (
    <button type="button" role="menuitem" onClick={onClick} className={cx('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[length:calc(13px*var(--fs-scale))] transition-colors', danger ? 'text-danger hover:bg-danger-soft' : 'text-ink hover:bg-surface-3', active && 'bg-brand-soft text-brand-ink')}>
      {I && <I size={15} strokeWidth={1.8} className={danger ? '' : 'text-ink-3'} aria-hidden />}
      <span className="flex-1 truncate">{typeof children === 'string' ? <ReferenceText message={children} /> : children}</span>
      {hint && <span className="text-[length:calc(11.5px*var(--fs-scale))] text-ink-3">{typeof hint === 'string' ? <ReferenceText message={hint} /> : hint}</span>}
    </button>
  );
}

/* ───────── Navigation bits ───────── */
export function Tabs({ tabs, value, onChange, className }: { tabs: { key: string; label: ReactNode; count?: number }[]; value: string; onChange: (k: string) => void; className?: string }) {
  return <SharedTabs className={className} value={value} onChange={onChange} items={tabs.map((t) => ({ id: t.key, label: typeof t.label === 'string' ? t.label : textOf(t.label) || t.key, badge: t.count }))} />;
}

export function Segmented<T extends string>({ options, value, onChange, size = 'md', label, disabled }: { options: { value: T; label?: ReactNode; icon?: LucideIcon; title?: string; disabled?: boolean }[]; value: T; onChange: (v: T) => void; size?: 'sm' | 'md'; label?: string; disabled?: boolean }) {
  return (
    <SharedSegmented
      label={label ?? options.map((o) => o.title ?? textOf(o.label) ?? o.value).join(' / ')}
      size={size}
      value={value}
      onChange={(v) => { if (!disabled) onChange(v as T); }}
      options={options.map((o) => {
        const I = o.icon;
        const text = textOf(o.label);
        return { value: o.value, label: text || o.title || o.value, icon: I ? <I size={14} strokeWidth={1.9} aria-hidden /> : undefined, iconOnly: !text && Boolean(I), disabled: disabled || o.disabled };
      })}
    />
  );
}

export function Stepper({ steps, current, failedAt }: { steps: string[]; current: number; failedAt?: number }) {
  return (
    <ol className="flex items-center gap-1 overflow-x-auto">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        const failed = failedAt === i;
        return (
          <li key={s} className="flex items-center gap-1 whitespace-nowrap" aria-current={active ? 'step' : undefined}>
            <span className={cx('grid h-5 w-5 place-items-center rounded-full text-[length:calc(11px*var(--fs-scale))] font-semibold', failed ? 'bg-danger text-white' : done ? 'bg-brand text-white' : active ? 'bg-accent text-rail' : 'bg-surface-3 text-ink-3')}>
              {failed ? <X size={11} strokeWidth={3} /> : done ? <Check size={11} strokeWidth={3} /> : i + 1}
            </span>
            <span className={cx('text-[length:calc(12.5px*var(--fs-scale))]', done || active ? 'text-ink font-medium' : 'text-ink-3')}><ReferenceText message={s} /></span>
            {i < steps.length - 1 && <span className={cx('mx-1 h-px w-5', done ? 'bg-brand' : 'bg-line-strong')} />}
          </li>
        );
      })}
    </ol>
  );
}

/* ───────── Feedback ───────── */
export function Skeleton({ className }: { className?: string }) {
  const { preferences } = useReferenceHost();
  if (preferences.loadingSkeletons === false) return null;
  return <SharedSkeleton className={cx('h-3', className)} />;
}
export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle size={18} className={cx('animate-spin text-brand', className)} aria-hidden />;
}
export function Kbd({ children }: { children: ReactNode }) {
  const { preferences } = useReferenceHost();
  if (!preferences.keyboardShortcuts || preferences.showKeyboardHints === false) return null;
  return <kbd className="rounded border border-line bg-surface-2 px-1 font-sans text-[length:calc(10.5px*var(--fs-scale))] text-ink-3">{children}</kbd>;
}
export function Progress({ value, tone = 'brand', className }: { value: number; tone?: 'brand' | 'ok' | 'warn' | 'danger'; className?: string }) {
  const c = { brand: 'bg-brand', ok: 'bg-ok', warn: 'bg-warn', danger: 'bg-danger' }[tone];
  const v = Math.max(0, Math.min(100, value));
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)} className={cx('h-1.5 w-full overflow-hidden rounded-full bg-surface-3', className)}>
      <div className={cx('h-full rounded-full transition-[width] duration-500', c)} style={{ width: `${v}%` }} />
    </div>
  );
}
export function Empty({ title, body, action, className }: { icon?: LucideIcon; title: string; body?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx('grid place-items-center', className)}>
      <EmptyState title={title} description={typeof body === 'string' ? body : textOf(body)} action={action} />
    </div>
  );
}
export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="m-3"><ErrorState description={message} onRetry={onRetry} /></div>;
}
export function Panel({ children, className, title, actions, bodyClass }: { children: ReactNode; className?: string; title?: ReactNode; actions?: ReactNode; bodyClass?: string }) {
  return (
    <SharedCard as="section" shadow="none" className={cx('flex min-h-0 flex-col', className)}>
      {(title || actions) && (
        <header className="flex items-center gap-2 border-b border-line px-3.5 py-2.5">
          <h3 className="flex-1 truncate text-[length:calc(13px*var(--fs-scale))] font-semibold text-ink">{typeof title === 'string' ? <ReferenceText message={title} /> : title}</h3>
          {actions}
        </header>
      )}
      <div className={cx('min-h-0 flex-1', bodyClass)}>{children}</div>
    </SharedCard>
  );
}

/* ───────── Toasts (scoped to the module; host toast preferences applied) ───────── */
type ToastItem = { id: number; tone: 'ok' | 'danger' | 'info'; text: string };
const ToastCtx = createContext<(text: string, tone?: ToastItem['tone']) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const { preferences } = useReferenceHost();
  const duration = preferences.toastDuration ?? 3500;
  const max = preferences.maxVisibleToasts ?? 3;
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const push = useCallback((text: string, tone: ToastItem['tone'] = 'ok') => {
    const id = ++seq.current;
    setItems((x) => [...x, { id, tone, text }].slice(-max));
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), duration);
  }, [duration, max]);
  useEffect(() => { setItems((x) => x.slice(-max)); }, [max]);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-10 right-4 z-[130] flex flex-col gap-2" aria-live="polite">
        {items.map((t) => {
          const I = t.tone === 'ok' ? CircleCheck : t.tone === 'danger' ? CircleAlert : Info;
          return (
            <div key={t.id} role={t.tone === 'danger' ? 'alert' : 'status'} className="pointer-events-auto flex min-w-[240px] max-w-sm items-center gap-2.5 rounded-lg border border-line bg-surface px-3 py-2.5 text-[length:calc(13px*var(--fs-scale))] shadow-pop anim-drawer">
              <I size={17} className={t.tone === 'ok' ? 'text-ok' : t.tone === 'danger' ? 'text-danger' : 'text-info'} aria-hidden />
              <span className="flex-1"><ReferenceText message={t.text} /></span>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

/* ───────── Print documents ───────── */
/**
 * Shared Table for print documents (invoice/voucher previews). Presentation preferences
 * are cleared for this subtree so result density, stripes and sticky headers never alter
 * a printed document; the source print markup and classes are otherwise unchanged.
 */
export function PrintTable(props: ComponentProps<'table'>) {
  return <PresentationProvider value={null}><SharedTable {...props} /></PresentationProvider>;
}

/* ───────── Attachments (in-memory only) ───────── */
const fileSize = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
/**
 * Replaces the source hidden file input. The source had no upload contract, so chosen
 * files are listed with their name and size for this screen only; nothing is uploaded or
 * persisted, and the list says so.
 */
export function LocalAttachments({ compact }: { compact?: boolean }) {
 const referenceT = useReferenceLocalization().t;

  const [files, setFiles] = useState<{ name: string; size: number }[]>([]);
  return (
    <div className={cx('rounded-lg border border-dashed border-line-strong text-center text-ink-3', compact ? 'px-3 py-2.5 text-[length:calc(12.5px*var(--fs-scale))]' : 'bg-surface-2 px-4 py-5 text-[length:calc(13px*var(--fs-scale))]')}>
      <div className={cx('flex items-center justify-center gap-2', !compact && 'flex-col gap-1')}>
        {!compact && <Upload size={18} aria-hidden />}
        <FilePicker label={compact ? 'Attach a file' : 'Choose files'} icon={compact ? <Upload size={14} aria-hidden /> : undefined} variant="ghost" onFile={(f) => setFiles((x) => [...x, { name: f.name, size: f.size }])} />
        {!compact && <span className="text-[length:calc(11.5px*var(--fs-scale))]"><ReferenceText message="PDF, images or spreadsheets up to 10 MB" /></span>}
      </div>
      {files.length > 0 && (
        <ul className="mt-2 divide-y divide-line rounded-md border border-line bg-surface text-left" aria-label={referenceT("Selected files")}>
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2.5 px-3 py-1.5 text-[length:calc(12.5px*var(--fs-scale))] text-ink">
              <FileText size={15} className="shrink-0 text-ink-3" aria-hidden />
              <span className="flex-1 truncate">{f.name}</span>
              <span className="text-[length:calc(11.5px*var(--fs-scale))] text-ink-3">{fileSize(f.size)}</span>
              <IconButton icon={X} size="sm" label={referenceT("Remove {value0}", {value0: f.name})} onClick={() => setFiles((x) => x.filter((_, j) => j !== i))} />
            </li>
          ))}
          <li className="px-3 py-1.5 text-[length:calc(11.5px*var(--fs-scale))] text-ink-3"><ReferenceText message="Selected on this screen only — not uploaded or saved." /></li>
        </ul>
      )}
    </div>
  );
}
