import {Avatar,Badge} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import {useFormatters} from '@pepbits/patterns/screen-host';
import {localDay} from './dates';
import {useKeystone} from './context';
import type {Row} from './types';
import './transaction-case.css';
export function caseAge(date:string,today=localDay()) {return Math.round((Date.parse(today+'T00:00:00Z')-Date.parse(date.slice(0,10)+'T00:00:00Z'))/86400000);}
export function CaseDate({date}:{date:string}) {
 const {t}=useLocalization(),format=useFormatters(),age=caseAge(date),count=format.number(Math.abs(age));
 return <time dateTime={date} title={format.date(date)}>{!Number.isFinite(age)?format.date(date):t(age===0?'today':age===1?'yesterday':age===-1?'tomorrow':age>1?'{count}d ago':'in {count}d',{count})}</time>;
}
export function CaseCardDetails({row}:{row:Row}) {
 const {t}=useLocalization(),format=useFormatters();return <><div className="erp-case-card-code"><span>{row.code}</span><Badge tone={row.priority==='Urgent'?'danger':row.priority==='High'?'warning':row.priority==='Normal'?'info':'neutral'}>{t(String(row.priority??''))}</Badge></div><p className="erp-case-card-meta">{row.customer??row.location} {row.category?`/ ${row.category}`:''}</p><div className="erp-case-card-owner"><Avatar name={String(row.assignee??'')} size="xs" decorative/><span>{row.assignee}</span>{row.created&&<span title={format.date(row.created)}>{format.number(caseAge(row.created))}{t('d')}</span>}</div></>;
}
export function CaseActivity({activities}:{activities:{at:string;by:string;text:string}[]}) {
 const {variant}=useKeystone();return <ol className="erp-case-conversation" data-variant={variant}>{activities.map((item,index)=><li key={index}><Avatar name={item.by} decorative size={variant==='erp1'?'xs':'sm'}/><div>{variant==='erp1'?<><p>{item.text}</p><div className="erp-case-byline"><strong>{item.by}</strong>, <CaseDate date={item.at}/></div></>:<><div className="erp-case-byline"><strong>{item.by}</strong><CaseDate date={item.at}/></div><p>{item.text}</p></>}</div></li>)}</ol>;
}
