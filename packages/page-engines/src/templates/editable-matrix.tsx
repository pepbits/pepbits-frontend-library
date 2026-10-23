import React from 'react';
import {Input,Select} from '@pepbits/ui';
import {CollectionView,type CollectionColumn} from '@pepbits/components/collection-view';
export function EditableMatrix<T>({rows,columns,dimensions,rowKey,rowLabel,values,onChange,options,disabled=false,loading=false}:{rows:T[];columns:CollectionColumn<T>[];dimensions:string[];rowKey:(row:T)=>string;rowLabel:(row:T)=>string;values:(row:T)=>readonly (string|number|null)[];onChange:(row:T,column:number,value:string|number|null)=>void;options?:{value:string;label:string}[];disabled?:boolean;loading?:boolean}) {
 return <CollectionView rows={rows} columns={[...columns,...dimensions.map((label,index)=>({key:'matrix-'+index,header:label,render:(row:T)=>options?<Select aria-label={rowLabel(row)+' '+label} value={String(values(row)[index]??'')} disabled={disabled} options={options} onChange={e=>onChange(row,index,e.target.value||null)}/>:<Input aria-label={rowLabel(row)+' '+label} type="number" min={0} value={String(values(row)[index]??'')} disabled={disabled} onChange={e=>onChange(row,index,e.target.value===''?null:Number(e.target.value))}/>}))]} rowKey={rowKey} loading={loading}/>;
}
