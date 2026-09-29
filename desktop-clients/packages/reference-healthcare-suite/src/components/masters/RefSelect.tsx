'use client';
import { useLookup } from '../../lib/lookups';
import { Option } from '../../lib/types';
import { Select } from '../ui/controls';

export function RefSelect({ entity, params, value, onChange, valueField = 'value', placeholder, invalid, disabled, id, waitingFor }: {
  entity: string; params?: Record<string, string | undefined> | null; value: string; onChange: (v: string, o?: Option) => void;
  valueField?: 'value' | 'code'; placeholder?: string; invalid?: boolean; disabled?: boolean; id?: string; waitingFor?: string;
}) {
  const { options, loading } = useLookup(entity, params === undefined ? {} : params);
  const opts = options.map((o) => ({ ...o, value: valueField === 'code' ? o.code ?? o.value : o.value, label: o.code && valueField === 'code' ? `${o.label} (${o.code})` : o.label }));
  // Keep the current value selectable even if it is inactive or filtered out.
  if (value && !loading && !opts.some((o) => o.value === value)) opts.unshift({ value, label: value, code: value, meta: undefined });
  return (
    <Select
      id={id}
      options={opts}
      value={value}
      invalid={invalid}
      disabled={disabled || params === null}
      placeholder={params === null ? `Choose ${waitingFor ?? 'parent'} first` : loading ? 'Loading' : placeholder ?? 'Select'}
      onChange={(v) => onChange(v, opts.find((o) => o.value === v))}
    />
  );
}
