'use client';

import { SectionPanel } from '../parts';
import { SectionTabs, type LayoutProps } from './nav';

/** Tabs: one section at a time, switched from a status-aware tab bar. */
export function TabsLayout(props: LayoutProps) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface">
      <SectionTabs {...props} variant="tabs" className="shrink-0" />
      <div role="tabpanel" className="scroll-thin min-h-0 flex-1 overflow-y-auto bg-bg/50 p-3 sm:p-4">
        <SectionPanel key={props.active} section={props.active} active className="animate-field-in" />
      </div>
    </div>
  );
}
