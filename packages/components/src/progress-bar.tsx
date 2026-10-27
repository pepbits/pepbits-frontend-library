import type {CSSProperties} from 'react';
import {useLocalization} from '@pepbits/i18n/react';

/** A labelled, bounded progress meter. Motion-free; colour comes from host tokens. */
export function ProgressBar({value,label,tone='primary',className}: {value:number;label:string;tone?:'primary'|'success'|'warning'|'danger';className?:string}) {
  const {t}=useLocalization(),bounded=Number.isFinite(value)?Math.max(0,Math.min(100,value)):0;
  return <div role="progressbar" aria-label={t(label)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(bounded)} className={className} style={{height:6,width:'100%',overflow:'hidden',borderRadius:'var(--radius)',background:'var(--surface-3)'}}>
    <div style={{height:'100%',width:`${bounded}%`,background:`var(--${tone})`} as CSSProperties}/>
  </div>;
}
