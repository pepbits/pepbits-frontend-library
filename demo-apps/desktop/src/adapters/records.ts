import {useMemo} from 'react';
import {useSession} from '@pepbits/platform/auth';
import {createHttpRecordAdapter} from '@pepbits/data';
import type {WorklistAdapter} from '@pepbits/page-engines/worklist';
import type {RecordHostValue} from '@pepbits/page-engines/records';
import {API_PRODUCT, readJson, useRequest, type Request} from './http';

type Row = Record<string, string | number | boolean>;
/** Scope keys isolate caches per account; the API derives authority from the bearer session. */
export function useDesktopIdentity() {
  const {user} = useSession();
  return JSON.stringify([user?.tenantId, user?.id, user?.role, user?.branch]);
}
/** Worklists use the shared engine wire protocol (`/worklists/search`, `/layouts`, `/views`, `/exports`) unchanged. */
export function useWorklistAdapter(): WorklistAdapter {
  const request = useRequest(), {user} = useSession(), identity = useDesktopIdentity();
  return useMemo(() => ({request, identity, applicationId: API_PRODUCT, sessionAvailable: true,
    actor: user ? {id: user.id, name: user.name, email: user.email, tenantId: user.tenantId} : undefined}), [request, identity, user]);
}
/** Record documents use the demo API record store through the shared data adapter. */
export function useRecordHostValue(): RecordHostValue {
  const request = useRequest(), identity = useDesktopIdentity();
  return useMemo(() => ({adapter: createHttpRecordAdapter(request), identity, applicationId: API_PRODUCT, sessionAvailable: true}), [request, identity]);
}
/** One worklist row by its primary key, searched with an operational filter so the row matches the table. */
export async function findRow(request: Request, page: {id: string; title: string; entity?: string}, primaryKey: string, id: string, signal?: AbortSignal): Promise<Row | null> {
  const response = await request('/worklists/search', {method: 'POST', signal, headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({pageId: page.id, title: page.title, entity: page.entity ?? 'record', productId: API_PRODUCT, safeFilters: {[primaryKey]: id}, sensitiveFilters: {}, pageSize: 50})});
  const body = await readJson<{rows?: Row[]}>(response);
  return body.rows?.find(row => String(row[primaryKey]) === id) ?? null;
}
