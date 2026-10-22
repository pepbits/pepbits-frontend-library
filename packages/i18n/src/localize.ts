import type {TranslationValues} from "./types";

/** Resolve an API display descriptor without translating record values. Older
 * servers and unknown product keys retain their readable fallback text. */
export function localizeApiMessage(descriptor: unknown, fallback: string, t: (key: string, values?: TranslationValues) => string): string {
  if (!descriptor || typeof descriptor !== 'object') return t(fallback);
  const {messageKey, messageValues} = descriptor as {messageKey?:unknown; messageValues?:unknown};
  if (typeof messageKey !== 'string' || !messageKey || !messageValues || typeof messageValues !== 'object' || Array.isArray(messageValues)) return t(fallback);
  if (Object.values(messageValues).some(value => typeof value !== 'string' && (typeof value !== 'number' || !Number.isFinite(value)))) return t(fallback);
  const result = t(messageKey, messageValues as TranslationValues);
  return result === messageKey ? t(fallback) : result;
}

/** Translate known validator messages at the UI boundary; unknown service errors
 * stay intact so product adapters can supply their own catalog entries. */
export function localizeFieldError(error: string | undefined, label: string, t: (message: string, values?: TranslationValues) => string): string | undefined {
  if (!error) return error;
  for (const suffix of [' cannot be empty.', ' must be a number.', ' cannot be negative.']) {
    if (error === label + suffix) return t('{field}' + suffix, {field:t(label)});
  }
  for (const suffix of [' is required', ' must be a number']) {
    if (error === label + suffix) return t('{field}' + suffix, {field: t(label)});
  }
  for (const suffix of [' must be at least ', ' must be at most ']) {
    if (error.startsWith(label + suffix)) return t('{field}' + suffix + '{value}', {field:t(label),value:error.slice((label + suffix).length)});
  }
  return t(error);
}

/** Structured presentation of legacy CSV parser errors; cell contents are never translated. */
export function localizeImportError(error: string, t: (message: string, values?: TranslationValues) => string): string {
  const row = /^Data row (\d+) has (\d+) cells; expected (\d+)\.$/.exec(error);
  return row ? t('Data row {row} has {actual} cells; expected {expected}.', {row:row[1]!,actual:row[2]!,expected:row[3]!}) : t(error);
}

/** Stage names are administrator-entered data. Translate the notice, not its name. */
export function localizeApprovalNotice(message: string, t: (message: string, values?: TranslationValues) => string): string {
  for (const prefix of ['Submitted for ', 'Advanced to ']) {
    if (message.startsWith(prefix)) return t(prefix + '{stage}', {stage:message.slice(prefix.length)});
  }
  return t(message);
}
