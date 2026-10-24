import React, {useMemo} from 'react';
import {createAiCatalogue} from '@pepbits/ai/config';
import {createAiClientWithRequest, type AiClassification} from '@pepbits/ai/client';
import {AiShellExtension, type AiPage} from '@pepbits/ai/ui';
import {useRequest} from '../../adapters/http';
import {pages} from '../../navigation';

/* Opt-in only (VITE_AI_ENABLED=true). Fields are named explicitly; the demo API's /ai/* routes
   decide policy, limits and credentials, and refuse dispatch when no provider is configured. */
export const desktopAiCatalogue = createAiCatalogue([
  {id: 'worklist.summarise-selection', label: 'Summarise selected customers', description: 'Sends the selected rows: customer ID, segment, credit limit, outstanding balance and status. Customer names are masked.', promptId: 'worklist-summary', category: 'general',
    reads: [{source: 'worklist-selection', fields: ['id', 'name', 'segment', 'creditLimit', 'outstanding', 'status']}]},
  {id: 'record.explain', label: 'Explain this customer record', description: 'Sends the saved record: code, type, segment, status, credit limit and risk rating. Names and contact details are masked.', promptId: 'record-explain', category: 'general',
    reads: [{source: 'page-record', fields: ['customerCode', 'legalName', 'customerType', 'segment', 'status', 'creditLimit', 'riskRating']}]},
]);
const personal = new Set(['name', 'legalName', 'tradeName', 'contact', 'contactName', 'email', 'phone']);
export const classifyDesktopField: AiClassification = key => personal.has(key) ? 'pii' : 'operational';
export const desktopAiPages: Record<string, AiPage> = Object.fromEntries(Object.values(pages).filter(page => page.ai?.enabled)
  .map(page => [page.id, {pageId: page.id, title: page.title, module: String(page.module), build: {enabled: true, useCases: [...page.ai!.useCases]}}]));

/** Wraps the shell with the assistant panel, inline actions and source publication. */
export function DesktopAi({children}: {children: React.ReactNode}) {
  const request = useRequest();
  const host = useMemo(() => ({client: createAiClientWithRequest(request, classifyDesktopField), catalogue: desktopAiCatalogue, pages: desktopAiPages, userEnabled: true, canManageAi: false}), [request]);
  return <AiShellExtension value={host}>{children}</AiShellExtension>;
}
