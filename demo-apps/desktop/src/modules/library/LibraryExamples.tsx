import React, {useState} from 'react';
import {Calendar, Card, DescriptionList, LineChart, Tabs} from '@pepbits/components';
import {Badge} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import {useFormatters} from '@pepbits/patterns/screen-host';
import {WorkspacePage} from '@pepbits/shell';
import type {PageRenderContext} from '@pepbits/page-engines/renderer';

/* Fictional values only. These examples show that shared components keep the host's
   preferences, direction and formatting inside a desktop document. */
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
const series = [{id: 'billed', label: 'Billed', values: [42000, 51000, 47500, 60200, 58800, 64100]}, {id: 'collected', label: 'Collected', values: [38000, 44000, 46100, 52000, 57300, 59900]}];

export function LibraryExamples({page}: PageRenderContext) {
  const {t} = useLocalization(), format = useFormatters();
  const [tab, setTab] = useState('values'), [day, setDay] = useState('2026-10-15');
  return <WorkspacePage><section aria-labelledby="library-examples-title" className="space-y-4 p-4" data-library-examples>
    <header className="space-y-1"><h1 id="library-examples-title" className="text-xl font-bold">{t(page.title)}</h1>
      <p className="text-[var(--text-muted)]">{t('Shared library components rendered inside the desktop frame with fictional values. Formatting, direction and motion follow your preferences.')}</p></header>
    <Tabs value={tab} onChange={setTab} items={[{id: 'values', label: t('Values')}, {id: 'chart', label: t('Chart')}, {id: 'calendar', label: t('Calendar')}]}/>
    {tab === 'values' ? <Card as="section" aria-label={t('Values')} className="p-4"><DescriptionList items={[
      {id: 'amount', label: t('Fictional balance'), value: format.money(125430.5)},
      {id: 'percent', label: t('Collection rate'), value: format.percent(93.4)},
      {id: 'date', label: t('Statement date'), value: format.date('2026-10-15')},
      {id: 'status', label: t('Status'), value: <Badge tone="success">{t('Active')}</Badge>},
    ]}/></Card> : null}
    {tab === 'chart' ? <Card as="section" aria-label={t('Chart')} className="p-4"><LineChart label={t('Fictional billing and collections')} labels={months.map(month => t(month))} series={series.map(item => ({...item, label: t(item.label)}))} formatValue={value => format.money(value)}/></Card> : null}
    {tab === 'calendar' ? <Card as="section" aria-label={t('Calendar')} className="space-y-2 p-4"><Calendar label={t('Statement date')} value={day} onChange={setDay}/><p>{t('Selected')}: {format.date(day)}</p></Card> : null}
  </section></WorkspacePage>;
}
