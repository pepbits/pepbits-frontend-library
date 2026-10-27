import type {ReactNode} from 'react';
import {Button,Input,Skeleton} from '@pepbits/ui';
import {Card,Table,TableContainer,LoadingState} from '@pepbits/components';
import {useLocalization} from '@pepbits/i18n/react';
import styles from './entry-matrix.module.css';

export interface EntryDimension {id:string;label:string;hint?:string;width:number;current?:boolean;muted?:boolean}
/** Controlled matrix with sticky identity/summary cells and aligned column totals. */
export function EntryMatrix<T>({title,rows,rowKey,rowLabel,identity,identityLabel,dimensions,values,onChange,summary,summaryLabel,totals,totalsLabel,options,disabled=false,loading=false,max=100,step=1,cellClassName,fillHeight=false,loadingRows=0,emptyCode='—',emptyState,showTotalsWhenEmpty=false}: {
  title:string;rows:T[];rowKey:(row:T)=>string;rowLabel:(row:T)=>string;identity:(row:T)=>ReactNode;identityLabel:string;
  dimensions:EntryDimension[];values:(row:T)=>readonly (string|number|null)[];onChange:(row:T,index:number,value:string|number|null)=>void;
  summary:(row:T)=>ReactNode;summaryLabel:string;totals?:ReactNode[];totalsLabel:string;options?:{value:string;label:string}[];
  fillHeight?:boolean;loadingRows?:number;emptyCode?:string;emptyState?:ReactNode;showTotalsWhenEmpty?:boolean;
  disabled?:boolean;loading?:boolean;max?:number;step?:number;cellClassName?:(value:string|number|null)=>string|undefined;
}) {
  const {t}=useLocalization();
  const change=(row:T,index:number,value:string|number|null)=>{if(!disabled&&!loading)onChange(row,index,value);};
  return <Card className={`${styles.root} ${fillHeight?styles.fill:''}`} data-entry-matrix>
    <TableContainer className={styles.scroll} aria-label={t(title)}><Table className={styles.table} aria-label={t(title)} aria-busy={loading}>
      <thead><tr><th scope="col" className={styles.identity}>{t(identityLabel)}</th>{dimensions.map(dimension=><th scope="col" key={dimension.id} data-current={dimension.current||undefined} data-muted={dimension.muted||undefined} style={{width:dimension.width,minWidth:dimension.width}}><div>{dimension.label}</div><small>{dimension.hint}</small></th>)}<th scope="col" className={styles.summary}>{t(summaryLabel)}</th></tr></thead>
      <tbody>{rows.map(row=><tr key={rowKey(row)}><th scope="row" className={styles.identity}>{identity(row)}</th>{dimensions.map((dimension,index)=>{
        const value=values(row)[index]??null,name=`${rowLabel(row)} ${dimension.id}`;
        return <td key={dimension.id} data-current={dimension.current||undefined} data-muted={dimension.muted||undefined} className={cellClassName?.(value)}>{options?<Button size="sm" variant="ghost" aria-label={`${name}: ${value||t('Not marked')}`} title={`${dimension.label}: ${options.find(option=>option.value===value)?.label??t('Not marked')}`} disabled={disabled||loading} onClick={()=>{const next=options[(options.findIndex(option=>option.value===String(value??''))+1)%options.length];change(row,index,next?.value||null);}}>{value||emptyCode}</Button>:<Input aria-label={name} type="number" min={0} max={max} step={step} value={value??''} disabled={disabled||loading} onChange={event=>{const number=event.target.value===''?null:Number(event.target.value);if(number===null||Number.isFinite(number))change(row,index,number===null?null:Math.min(max,Math.max(0,number)));}}/>}</td>;
      })}<td className={styles.summary}>{summary(row)}</td></tr>)}{!rows.length&&(loading&&loadingRows>0?Array.from({length:loadingRows},(_,index)=><tr key={index} data-entry-placeholder><td className={styles.identity}><Skeleton className="h-3 w-32"/></td><td colSpan={dimensions.length+1}/></tr>):!loading&&emptyState===null?null:<tr><td colSpan={dimensions.length+2}>{loading?<LoadingState/>:emptyState??t('No matching records')}</td></tr>)}</tbody>
      {totals&&(!!rows.length||showTotalsWhenEmpty)&&<tfoot><tr><th scope="row" className={styles.identity}>{t(totalsLabel)}</th>{dimensions.map((dimension,index)=><td key={dimension.id}>{totals[index]}</td>)}<td className={styles.summary}/></tr></tfoot>}
    </Table></TableContainer>
  </Card>;
}
