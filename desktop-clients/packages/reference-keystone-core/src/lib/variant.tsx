'use client';
/*
 * Variant configuration supplied by each ERP module. Core renderers read it instead of
 * importing a variant package: ERP1 keeps source callbacks/dialogs (records: false),
 * ERP2 turns on default row → record navigation, new-tab and record memory (records: true).
 */
import { createContext, useContext, useMemo, type ComponentType, type ReactNode } from 'react';
import type { PageDef, Section, TemplateKey } from './types';
import { findPageIn, ownerDefIn } from './registry';

export type KeystoneVariantId = 'erp1' | 'erp2';
export interface KeystoneVariantConfig {
  id: KeystoneVariantId;
  /** Full-page record routes (/new, /:id, /:id/edit) exist. */
  records: boolean;
  pages: readonly PageDef[];
  sections: readonly { key: Section; label: string; icon: string }[];
  templates: Record<TemplateKey, ComponentType<{ def: PageDef }>>;
}
export interface KeystoneVariant extends KeystoneVariantConfig {
  findPage: (section?: string, slug?: string) => PageDef | undefined;
  ownerDef: (entity: string) => PageDef | undefined;
}
const VariantContext = createContext<KeystoneVariant | null>(null);

export function KeystoneVariantProvider({ config, children }: { config: KeystoneVariantConfig; children: ReactNode }) {
  const value = useMemo<KeystoneVariant>(() => ({
    ...config,
    findPage: (section, slug) => findPageIn(config.pages, section, slug),
    ownerDef: (entity) => ownerDefIn(config.pages, entity),
  }), [config]);
  return <VariantContext.Provider value={value}>{children}</VariantContext.Provider>;
}
export function useKeystoneVariant(): KeystoneVariant {
  const v = useContext(VariantContext);
  if (!v) throw new Error('Keystone renderers require KeystoneVariantProvider');
  return v;
}
