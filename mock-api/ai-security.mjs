import {DATA_CLASSIFICATIONS} from '../desktop-clients/packages/erp-config/src/data-classification.ts';
import {reportRows} from '../desktop-clients/packages/erp-data/src/report-data.ts';
import {USE_CASES} from '../desktop-clients/packages/ai-config/src/use-cases.ts';

export const APPROVED_PROVIDERS = new Set(['https://api.openai.com/v1', 'https://api.deepseek.com']);
export function providerAllowed(endpoint) {
  return typeof endpoint === 'string' && APPROVED_PROVIDERS.has(endpoint.replace(/\/+$/, ''));
}
export function credentialExpired(held, now = Date.now()) {
  const at = Date.parse(held?.rotatedAt ?? held?.setAt ?? '');
  return !Number.isFinite(at) || now-at >= 90*86400000 || at > now+60000;
}
/** Refuse free text and clinical requests until a contracted service can validate them.
 * A regex cannot prove text contains no identifiers. Numeric context is the only
 * unmasked payload accepted; canonical labels come from field keys, not the caller.
 */
export function redactProviderContext(body) {
  const useCase = USE_CASES.find(item => item.id === body?.useCaseId && item.promptId === body?.promptId);
  if (!useCase || useCase.category === 'clinical' || body?.userInput?.trim()) throw new Error('AI context is not approved for this provider.');
  const permitted = new Set(useCase.reads.flatMap(read => read.fields));
  if (!Array.isArray(body.fields) || !body.fields.length || body.fields.length > 100) throw new Error('AI context is not approved for this provider.');
  return body.fields.map(field => {
    if (!permitted.has(field?.key) || DATA_CLASSIFICATIONS[field.key] === undefined) throw new Error('AI context is not approved for this provider.');
    const value = String(field.value ?? '');
    const classification = DATA_CLASSIFICATIONS[field.key];
    const approvedDimension = body.useCaseId === 'report.summarise' && field.key === 'dimension' && reportRows.some(row => row.dimension === value);
    if (['credential','unclassified','clinical'].includes(classification)) throw new Error('AI context is not approved for this provider.');
    if (classification !== 'operational') {
      if (value !== '••••••••') throw new Error('AI context is not approved for this provider.');
    } else if (!approvedDimension && !/^-?\d+(?:\.\d+)?%?$/.test(value) && value !== '••••••••') {
      throw new Error('AI context is not approved for this provider.');
    }
    return {key:field.key, label:field.key, value};
  });
}
export function createUserLimiter({requestsPerMinute = 10, now = Date.now} = {}) {
  const userWindow = new Map();
  return {
    admit(user) {
      const time = now();
      for (const [key, entries] of userWindow) if (!entries.some(at => time-at < 60000)) userWindow.delete(key);
      const key = JSON.stringify([user.tenantId,user.id]);
      const entries = (userWindow.get(key) ?? []).filter(at => time-at < 60000);
      if (entries.length >= requestsPerMinute) return false;
      entries.push(time); userWindow.set(key,entries); return true;
    },
  };
}
