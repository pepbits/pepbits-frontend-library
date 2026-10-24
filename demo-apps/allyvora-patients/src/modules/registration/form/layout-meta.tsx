'use client';
import React from 'react';
import type {LayoutKind} from '@allyvora/shared';
import {AlignLeft, ListTodo, PanelTop, Route, Rows3} from '@pepbits/icons';
import {Segmented, cn} from '@pepbits/ui';

export interface LayoutMeta {id: LayoutKind; name: string; summary: string; bestFor: string}
/** Source layout descriptions (the source frontend lib/layouts.ts), unchanged. */
export const LAYOUTS: LayoutMeta[] = [
  {id: 'scroll', name: 'Single page', summary: 'Every section on one page with a section list on the side that follows your scroll.', bestFor: 'Experienced staff who type straight through'},
  {id: 'tabs', name: 'Tabs', summary: 'One section at a time, switched with tabs that show what’s done and what needs fixing.', bestFor: 'Updating a few details on an existing record'},
  {id: 'wizard', name: 'Guided steps', summary: 'Step through sections in order. Each step is checked before you move on.', bestFor: 'New staff and occasional users'},
  {id: 'stepper', name: 'Side steps', summary: 'A labelled step list on the left with one section open at a time. Jump to any step.', bestFor: 'Wide screens and mixed experience levels'},
  {id: 'accordion', name: 'Accordion', summary: 'Sections fold open one at a time on a single page, each showing its status when closed.', bestFor: 'Tablets and smaller screens'},
];
export const layoutMeta = (id: LayoutKind) => LAYOUTS.find(layout => layout.id === id)!;
export const LAYOUT_ICONS: Record<LayoutKind, typeof AlignLeft> = {scroll: AlignLeft, tabs: PanelTop, wizard: Route, stepper: ListTodo, accordion: Rows3};

/** Compact icon switcher so staff can change the organisation layout without leaving the form. */
export function LayoutSwitcher({value, onChange, disabled, className}: {value: LayoutKind; onChange: (layout: LayoutKind) => void; disabled?: boolean; className?: string}) {
  return <Segmented label="Form layout" size="sm" className={cn(className)} value={value} onChange={next => onChange(next as LayoutKind)}
    options={LAYOUTS.map(layout => {const Icon = LAYOUT_ICONS[layout.id]; return {value: layout.id, label: layout.name, icon: <Icon className="size-4" aria-hidden="true"/>, iconOnly: layout.id !== value, disabled};})}/>;
}
