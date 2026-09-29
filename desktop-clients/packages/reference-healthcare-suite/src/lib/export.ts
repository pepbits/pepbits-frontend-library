'use client';
import {useCallback} from 'react';
import {useReferenceHost} from '@pepbits/reference-host';
import {downloadCsv as writeCsv} from '../components/masters/cells';
/** The source provides CSV. Unsupported effective formats are disabled, never silently substituted. */
export function useCsvExport() {
 const host=useReferenceHost();const format=host.preferences.exportFormat;const rule=host.preferenceHost?.preferencePolicy?.rules.exportFormat;
 const disabled=format!=='csv'||!!(rule?.allowedValues&&!rule.allowedValues.includes(format));
 const reason=disabled?'Healthcare Suite exports CSV only. Choose an allowed CSV format in preferences.':undefined;
 const downloadCsv=useCallback((name:string,headers:string[],rows:(string|number)[][])=>{if(disabled)return false;writeCsv(name,headers,rows);return true;},[disabled]);
 return {disabled,reason,downloadCsv};
}
