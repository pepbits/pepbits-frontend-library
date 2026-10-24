'use client';
import React, {useEffect, useMemo, useState} from 'react';
import {RotateCcw} from '@pepbits/icons';
import {useLocalization} from '@pepbits/i18n/react';
import {useFormatters} from '@pepbits/patterns/screen-host';
import {cn} from '@pepbits/ui';
import {EMRAM_TARGETS, INTEGRATIONS, MODULE_GROUPS, STANDARD_GROUPS, country, recommendedModules} from '../../catalog';
import {CheckRow, Segmented, ToggleChip} from '../../ui/Choice';
import {Section} from '../Section';
import {toggle, type StepProps} from '../types';

type Tab = 'modules' | 'standards' | 'integrations';
export function StepModules({data, errors, setData}: StepProps) {
  const {t} = useLocalization(), format = useFormatters();
  const [tab, setTab] = useState<Tab>('modules');
  const recommended = useMemo(() => recommendedModules(data.facilityTypes, data.structure === 'network'), [data.facilityTypes, data.structure]);
  const recSet = useMemo(() => new Set(recommended), [recommended]);
  const totalModules = MODULE_GROUPS.reduce((n, group) => n + group.modules.length, 0);
  const c = country(data.org.country);
  useEffect(() => {if (errors.modules) setTab('modules');}, [errors.modules]);
  const isRecommendedState = recommended.length === data.modules.length && recommended.every(m => data.modules.includes(m));
  const localIntegrations = INTEGRATIONS.filter(i => c && i.countries.includes(c.code));
  const globalIntegrations = INTEGRATIONS.filter(i => i.countries.length === 0);
  const otherIntegrations = INTEGRATIONS.filter(i => i.countries.length > 0 && !(c && i.countries.includes(c.code)));
  const toggleIntegration = (id: string) => setData(d => ({...d, integrations: toggle(d.integrations, id)}));
  return <div>
    <div className="sticky top-0 z-10 -mx-4 bg-paper/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none" data-invalid={errors.modules ? 'true' : undefined} tabIndex={-1} id="modules" aria-describedby={errors.modules ? 'modules-error' : undefined}>
      <Segmented<Tab> label="Setup section" value={tab} onChange={setTab} className="w-full sm:w-auto sm:max-w-xl" options={[
        {value: 'modules', label: <TabLabel text="Modules" count={format.number(data.modules.length)} error={!!errors.modules}/>},
        {value: 'standards', label: <TabLabel text="Standards" count={format.number(data.standards.length)}/>},
        {value: 'integrations', label: <TabLabel text="Integrations" count={format.number(data.integrations.length)}/>},
      ]}/>
    </div>
    <div key={tab} className="mt-7 animate-fade-in">
      {tab === 'modules' && <Section title={t('{selected} of {total} modules selected', {selected: format.number(data.modules.length), total: format.number(totalModules)})}
        description={t('{count} modules are suggested for the facility types you chose. Unselected suggestions are tagged.', {count: format.number(recommended.length)})} error={errors.modules} errorId="modules"
        aside={!isRecommendedState && <button type="button" onClick={() => setData(d => ({...d, modules: recommended}))} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-scrub-800 hover:bg-scrub-50"><RotateCcw className="h-3.5 w-3.5" aria-hidden="true"/>{t('Reset to suggested')}</button>}>
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {MODULE_GROUPS.map(group => {
            const ids = group.modules.map(m => m.id), count = ids.filter(id => data.modules.includes(id)).length, all = count === ids.length;
            return <div key={group.id} className="rounded-2xl border border-ink-200 bg-surface p-2">
              <div className="flex items-center justify-between gap-2 px-3 pb-1 pt-2">
                <p className="font-semibold text-ink-900">{t(group.label)}<span className="ms-2 text-sm font-normal tabular-nums text-ink-500">{format.number(count)}/{format.number(ids.length)}</span></p>
                <button type="button" aria-label={t(all ? 'Clear {group}' : 'Select all {group}', {group: t(group.label)})} onClick={() => setData(d => ({...d, modules: all ? d.modules.filter(m => !ids.includes(m)) : Array.from(new Set([...d.modules, ...ids]))}))} className="rounded-md px-1.5 py-0.5 text-[length:calc(0.8rem*var(--fs-scale))] font-semibold text-scrub-800 hover:bg-scrub-50">{t(all ? 'Clear' : 'Select all')}</button>
              </div>
              <div className="space-y-0.5">{group.modules.map(m => <CheckRow key={m.id} id={`module-${m.id}`} checked={data.modules.includes(m.id)} onChange={() => setData(d => ({...d, modules: toggle(d.modules, m.id)}))} label={m.label} description={m.description} tag={recSet.has(m.id) && !data.modules.includes(m.id) ? 'Suggested' : undefined}/>)}</div>
            </div>;
          })}
        </div>
      </Section>}
      {tab === 'standards' && <div className="space-y-10">
        <Section title="Standards you follow" description="We switch on the matching controls, code sets and audit reports. Pre-selected items are recommended for every organization.">
          <dl className="divide-y divide-ink-100 rounded-2xl border border-ink-200 bg-surface">
            {STANDARD_GROUPS.map(group => <div key={group.id} className="grid gap-3 p-4 sm:grid-cols-[13rem_minmax(0,1fr)] sm:gap-6 sm:p-5">
              <dt><p className="font-semibold text-ink-900">{t(group.label)}</p><p className="mt-0.5 text-[length:calc(0.8rem*var(--fs-scale))] leading-snug text-ink-500">{t(group.description)}</p></dt>
              <dd className="flex flex-wrap content-start gap-2">{group.items.map(item => <ToggleChip key={item.id} selected={data.standards.includes(item.id)} onToggle={() => setData(d => ({...d, standards: toggle(d.standards, item.id)}))}><span dir="ltr">{item.label}</span></ToggleChip>)}</dd>
            </div>)}
          </dl>
        </Section>
        <Section title="HIMSS EMRAM target" description="If you are working toward an EMRAM stage, we'll track the criteria on your quality dashboard.">
          <Segmented label="HIMSS EMRAM target stage" value={data.emramTarget} onChange={value => setData(d => ({...d, emramTarget: value}))} options={EMRAM_TARGETS.map(target => ({value: target.value, label: target.label}))} className="w-full max-w-lg"/>
        </Section>
      </div>}
      {tab === 'integrations' && <div className="space-y-9">
        {localIntegrations.length > 0 && <IntegrationGroup title={t('Health authority and payer links for {country}', {country: t(c!.name)})} description="Required or common for licensed providers in your country." items={localIntegrations} selected={data.integrations} onToggle={toggleIntegration} highlight/>}
        <IntegrationGroup title="Available everywhere" items={globalIntegrations} selected={data.integrations} onToggle={toggleIntegration}/>
        <IntegrationGroup title={c ? 'Other regions' : 'Health authority and payer links'} description={c ? undefined : 'Choose your country in step 2 to see the ones that apply to you first.'} items={otherIntegrations} selected={data.integrations} onToggle={toggleIntegration} withRegion/>
      </div>}
    </div>
  </div>;
}
function TabLabel({text, count, error}: {text: string; count: string; error?: boolean}) {
  const {t} = useLocalization();
  return <><span className="truncate">{t(text)}</span><span className={cn('rounded-full px-1.5 text-[length:calc(0.7rem*var(--fs-scale))] font-semibold tabular-nums', error ? 'bg-signal text-white' : 'bg-ink-200/70 text-ink-700')}>{count}</span></>;
}
function IntegrationGroup({title, description, items, selected, onToggle, highlight, withRegion}: {title: string; description?: string; items: typeof INTEGRATIONS; selected: string[]; onToggle: (id: string) => void; highlight?: boolean; withRegion?: boolean}) {
  const {t} = useLocalization();
  return <Section title={title} description={description}>
    <div className={cn('flex flex-wrap gap-2', highlight && 'rounded-2xl border border-scrub-200 bg-scrub-50/50 p-4')}>
      {items.map(item => <ToggleChip key={item.id} selected={selected.includes(item.id)} onToggle={() => onToggle(item.id)} tag={withRegion ? item.countries.join(', ') : undefined}>{t(item.label)}</ToggleChip>)}
    </div>
  </Section>;
}
