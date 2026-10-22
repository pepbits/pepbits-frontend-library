import type { LayoutKind } from '@allyvora/shared';

export interface LayoutMeta {
  id: LayoutKind;
  name: string;
  summary: string;
  bestFor: string;
}

export const LAYOUTS: LayoutMeta[] = [
  {
    id: 'scroll',
    name: 'Single page',
    summary: 'Every section on one page with a section list on the side that follows your scroll.',
    bestFor: 'Experienced staff who type straight through',
  },
  {
    id: 'tabs',
    name: 'Tabs',
    summary: 'One section at a time, switched with tabs that show what’s done and what needs fixing.',
    bestFor: 'Updating a few details on an existing record',
  },
  {
    id: 'wizard',
    name: 'Guided steps',
    summary: 'Step through sections in order. Each step is checked before you move on.',
    bestFor: 'New staff and occasional users',
  },
  {
    id: 'stepper',
    name: 'Side steps',
    summary: 'A labelled step list on the left with one section open at a time. Jump to any step.',
    bestFor: 'Wide screens and mixed experience levels',
  },
  {
    id: 'accordion',
    name: 'Accordion',
    summary: 'Sections fold open one at a time on a single page, each showing its status when closed.',
    bestFor: 'Tablets and smaller screens',
  },
];

export const layoutMeta = (id: LayoutKind) => LAYOUTS.find((l) => l.id === id)!;
