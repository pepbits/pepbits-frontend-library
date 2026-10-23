/** Map text IDs without numeric coercion. The catalog editor uses value|label lines. */
export function mapCsvOptions(rows:string[][],valueColumn:string,labelColumn:string){
 const value=Number(valueColumn),label=Number(labelColumn);
 if(valueColumn===''||labelColumn===''||value===label||!Number.isInteger(value)||!Number.isInteger(label)||value<0||label<0)throw new Error('designer.csvMapping');
 if(!rows.length||rows.length>1000)throw new Error('designer.datasetLimit');
 const seen=new Set<string>();
 return rows.map((row,index)=>{
  const id=row[value],text=row[label];
  const valid=typeof id==='string'&&typeof text==='string'&&!!id.trim()&&!!text.trim()&&id.length<=80&&text.length<=160&&!/[|\r\n]/.test(id+text)&&!seen.has(id);
  if(id!==undefined)seen.add(id);
  return {row:index+1,value:id??'',label:text??'',error:valid?null:'designer.csvRow'};
 });
}
