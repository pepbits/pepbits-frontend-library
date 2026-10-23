import {useCallback} from 'react';
import {useSuiteHost} from '../host';
import {useFormatters} from '@pepbits/patterns/screen-host';
import {exportRows} from '@pepbits/page-engines/worklist';
export function useCsvExport() {
 const host=useSuiteHost(),format=useFormatters();
 const disabled=host.preferences.exportFormat!=='csv';
 const downloadCsv=useCallback((name:string,headers:string[],rows:(string|number)[][])=>{
  if(disabled)return false;
  // Product exports contain synthetic patient/financial values; all columns are explicitly classified.
  exportRows(rows.map(row=>Object.fromEntries(row.map((value,index)=>[String(index),value]))),headers.map((label,index)=>({key:String(index),label,classification:'pii'})),format,'csv',name.replace(/\.csv$/,''));
  return true;
 },[disabled,format]);
 return {disabled,reason:disabled?'Healthcare Suite exports CSV only. Choose an allowed CSV format in preferences.':undefined,downloadCsv};
}
