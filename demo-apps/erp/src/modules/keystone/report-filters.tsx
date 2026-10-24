import {useState} from 'react';
import {ReportFilterField, activeReportFilter, validReportFilters, type ReportFilters, type ReportFilterDefinition, type ReportFilterValue} from '@pepbits/page-engines/templates';
import {Button} from '@pepbits/ui';
import {Card, LoadingState, RecoveryNotice, failureFromError} from '@pepbits/components';
import {useLocalization} from '@pepbits/i18n/react';
import {useFetch, listUrl} from './client';
import type {Field, ListResponse} from './types';
export function reportFilterDefinition(field: Field): ReportFilterDefinition {
  return {key: field.key, label: field.label, type: ['ref','select','status'].includes(field.type) ? 'choice' : ['currency','number','percent'].includes(field.type) ? 'number' : field.type === 'date' ? 'date' : field.type === 'boolean' ? 'boolean' : 'text', options: field.options};
}
function FieldFilter({field, value, onChange}: {field: Field; value?: ReportFilterValue; onChange: (value?: ReportFilterValue) => void}) {
  const result = useFetch<ListResponse>(field.type === 'ref' && field.ref ? listUrl(field.ref, {size: 5000}) : null), {t} = useLocalization();
  const definition = reportFilterDefinition(field);
  if (field.type === 'ref') definition.options = result.data?.rows.map(row => String(row.name ?? row.code ?? row.id)) ?? [];
  return <div>{result.loading ? <LoadingState/> : null}{result.error ? <RecoveryNotice failure={failureFromError(new Error(result.error))} onRetry={result.reload}/> : null}
    {result.data && result.data.total > result.data.rows.length ? <p role="status">{t('More choices exist than can be displayed.')}</p> : null}
    <ReportFilterField definition={definition} value={value} onChange={onChange} disabled={result.loading || !!result.error}/></div>;
}
export function ReportFilterPanel({fields, value, onApply, onClose}: {fields: Field[]; value: ReportFilters; onApply: (value: ReportFilters) => void; onClose: () => void}) {
  const [draft, setDraft] = useState(value), {t} = useLocalization(), valid = validReportFilters(draft);
  return <Card className="p-3 space-y-3" role="region" aria-label={t('Advanced filter')}>
    <div className="grid gap-3 md:grid-cols-3">{fields.filter(field => field.type !== 'code' && field.type !== 'textarea' && (field.filter || ['date','number','currency','percent','boolean'].includes(field.type))).map(field => <FieldFilter key={field.key} field={field} value={draft[field.key]} onChange={value => setDraft(old => {const next = {...old};if (value === undefined) delete next[field.key];else next[field.key] = value;return next;})}/>)}</div>
    {!valid ? <p role="alert">{t('Choose a valid range')}</p> : null}
    <div className="flex gap-2"><Button onClick={() => setDraft({})}>{t('Reset')}</Button><Button onClick={onClose}>{t('Cancel')}</Button><Button disabled={!valid} onClick={() => {if (valid) onApply(Object.fromEntries(Object.entries(draft).filter(([,value]) => activeReportFilter(value))));}}>{t('Apply filters')}</Button></div>
  </Card>;
}
