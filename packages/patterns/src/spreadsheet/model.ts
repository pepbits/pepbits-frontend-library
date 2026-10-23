import {reviewExport, type DataColumn} from "./export-policy";
export type SheetCell = string | number;
/** This workspace is a costing sheet, not an arbitrary-column data importer. */
export const SHEET_FIELDS: DataColumn[] = [
  {key:"sheetItemCode",label:"Item Code",classification:"operational",type:"text"},
  {key:"sheetDescription",label:"Description",classification:"operational",type:"text"},
  {key:"sheetQuantity",label:"Quantity",classification:"operational",type:"number"},
  {key:"sheetUnitCost",label:"Unit Cost",classification:"operational",type:"money"},
  {key:"sheetDiscount",label:"Discount %",classification:"operational",type:"percent"},
  {key:"sheetTax",label:"Tax %",classification:"operational",type:"percent"},
  {key:"sheetNetCost",label:"Net Cost",classification:"operational",type:"money"},
  {key:"sheetSupplier",label:"Supplier",classification:"operational",type:"text"},
];
export const SHEET_COLUMNS = SHEET_FIELDS.map(field=>field.label);
export function importSheet(matrix: unknown[][]): SheetCell[][] {
  const normalize=(value:unknown)=>String(value??'').trim().toLowerCase();
  const headers=matrix[0]?.map(normalize)??[];
  if(headers.length!==SHEET_COLUMNS.length||new Set(headers).size!==headers.length||headers.some(header=>!SHEET_COLUMNS.some(column=>normalize(column)===header)))throw new Error('Use the eight costing-template column headers. Unknown or duplicate columns cannot be imported.');
  const order=SHEET_COLUMNS.map(column=>headers.indexOf(normalize(column)));
  const rows=matrix.slice(1).filter(row=>row.some(cell=>cell!==''&&cell!==null&&cell!==undefined));
  if(rows.length>500)throw new Error('Import at most 500 costing rows.');
  return rows.map(row=>{
    if(row.length>headers.length&&row.slice(headers.length).some(value=>value!==''&&value!==null&&value!==undefined))throw new Error('Values outside the costing-template columns cannot be imported.');
    return order.map((index,column)=>{
      const value=row[index]??'';
      if(!['string','number'].includes(typeof value)||String(value).length>4000)throw new Error('Costing cells must contain text or finite numbers, up to 4000 characters.');
      if(typeof value==='number'&&!Number.isFinite(value))throw new Error('Costing cells must contain text or finite numbers, up to 4000 characters.');
      if(column>=2&&column<=6&&value!==''){
        const number=Number(value);
        if(!Number.isFinite(number)||number<0||([4,5].includes(column)&&number>100))throw new Error('Costing amounts must be non-negative numbers; percentages must be between 0 and 100.');
        return number;
      }
      return value as SheetCell;
    });
  });
}
export function reviewSheetExport() {
  const review=reviewExport(SHEET_FIELDS);
  // A future schema/classification change must not silently bypass confirmation.
  if(!review.silent||review.carried.length!==SHEET_FIELDS.length)throw new Error('The costing export schema requires review before downloading.');
  return review;
}
