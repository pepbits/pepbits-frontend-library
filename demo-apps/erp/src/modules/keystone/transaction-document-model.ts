import type {Field,PageDef,Row} from './types';
const number=(value:unknown)=>Number(value)||0;
const round=(value:number)=>Math.round(value*100)/100;
export const isTransactionDocument=(def:PageDef)=>def.section==='transactions'&&['document','voucher'].includes(def.template);
export function blankDocumentLine(fields:Field[]) {
  return Object.fromEntries(fields.map(field=>[field.key,['number','currency','percent'].includes(field.type)?field.key==='qty'?1:0:field.type==='select'?field.options?.[0]??'':'']));
}
export function documentTotals(def:PageDef,lines:Record<string,unknown>[]) {
  const debit=round(lines.reduce((sum,line)=>sum+number(line.debit),0)),credit=round(lines.reduce((sum,line)=>sum+number(line.credit),0));
  const subtotal=round(lines.reduce((sum,line)=>sum+number(line.amount),0)),tax=round(lines.reduce((sum,line)=>sum+number(line.amount)*number(line.tax)/100,0));
  return {debit,credit,difference:round(debit-credit),subtotal,tax,total:def.template==='voucher'?debit:round(subtotal+tax),balanced:round(debit-credit)===0&&debit>0};
}
export function documentFlow(def:PageDef,row:Partial<Row>) {
  const flow=def.statusFlow??[],status=String(row.status??flow[0]??'Draft'),index=flow.indexOf(status),terminal=['Cancelled','Reversed','Rejected'].includes(status),done=terminal||status===flow.at(-1);
  return {flow,status,index:index<0?Math.max(0,flow.length-2):index,terminal,done,next:done?undefined:index<0?flow.at(-1):flow[index+1]};
}
export function documentSeed(def:PageDef,variant:'erp1'|'erp2',date:string,copy?:Partial<Row>):Row {
  return {...copy,id:'',code:undefined,version:undefined,date,status:def.statusFlow?.[0]??'Draft',lines:copy?.lines??(variant==='erp1'?[]:Array.from({length:def.template==='voucher'?2:1},()=>blankDocumentLine(def.lines!.fields)))} as Row;
}
export function computeDocumentLines(def:PageDef,previous:Record<string,unknown>[],next:Record<string,unknown>[]) {
  return next.map((line,index)=>{
    const value={...line};
    if(def.template==='voucher') {
      if(number(value.debit)>0&&value.debit!==previous[index]?.debit)value.credit=0;
      else if(number(value.credit)>0&&value.credit!==previous[index]?.credit)value.debit=0;
    } else if('qty' in value||'rate' in value)value.amount=round(number(value.qty)*number(value.rate));
    return value;
  });
}
