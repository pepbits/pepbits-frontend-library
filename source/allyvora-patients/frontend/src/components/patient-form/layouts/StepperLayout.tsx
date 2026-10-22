'use client';

import { SectionPanel } from '../parts';
import { SectionList, SectionTabs, type LayoutProps } from './nav';

/** Side steps: labelled vertical steps on the left, the open step on the right. */
export function StepperLayout(props: LayoutProps) {
  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row lg:gap-4">
      <aside className="hidden w-72 shrink-0 overflow-hidden rounded-2xl border border-line bg-surface lg:block">
        <SectionList {...props} variant="stepper" />
      </aside>
      <SectionTabs {...props} variant="chips" className="shrink-0 lg:hidden" />
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto pb-6">
        <SectionPanel key={props.active} section={props.active} active className="animate-field-in" />
      </div>
    </div>
  );
}
