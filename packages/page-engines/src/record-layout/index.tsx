"use client";
import React,{createContext,useContext,useEffect,useRef,useId,type ReactNode} from 'react';
import {Button,cn} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import {usePreferences} from '@pepbits/preferences/react';
import {StatusGlyph,StatusPill,type RecordSectionProgress} from '@pepbits/patterns/record-form';
import {ChevronDown} from '@pepbits/icons';
import {LayoutData,SectionList,SectionTabs,type RecordFormSection} from './navigation';
export type {RecordFormSection};
export type {RecordSectionProgress};
const AccordionSection=createContext(false);
const SectionHeadingLevel=createContext<2|3>(3);
export function scrollWithin(element:HTMLElement,align:'start'|'center'='center',reducedMotion=false) {
 let parent=element.parentElement;
 while(parent && parent!==document.body){const overflow=getComputedStyle(parent).overflowY;if((overflow==='auto'||overflow==='scroll')&&parent.scrollHeight>parent.clientHeight){const rect=element.getBoundingClientRect(),box=parent.getBoundingClientRect();parent.scrollTo?.({top:parent.scrollTop+rect.top-box.top-(align==='start'?4:box.height/2-Math.min(rect.height,box.height)/2),behavior:reducedMotion?'auto':'smooth'});return;}parent=parent.parentElement;}
}
export const sectionDomId=(uid:string,section:string)=>`${uid}-s-${section}`;
export function RecordSectionCard({id,title,subtitle,index,icon,reading,onRead,children,appearance='default',progress,active,actions,headingLevel}: {
 id:string;title:string;subtitle?:string;index:number;icon?:ReactNode;reading?:boolean;onRead?:()=>void;children:ReactNode;appearance?:'default'|'plain';progress?:RecordSectionProgress;active?:boolean;actions?:ReactNode;headingLevel?:2|3;
}) {
 const {t}=useLocalization(),{preferences}=usePreferences();const compact=preferences.density==='compact',accordion=useContext(AccordionSection);
 const inheritedHeading=useContext(SectionHeadingLevel),Heading=(headingLevel??inheritedHeading)===2?'h2':'h3';
 return <section data-clinical-section={id} data-section={id} className={accordion?undefined:"scroll-mt-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)]"}>
 <header hidden={accordion} className={cn('flex items-center gap-3 border-b border-[var(--border)]',compact?'px-4 py-2.5':'px-5 py-3.5')}>
 {progress?<StatusGlyph index={index+1} progress={progress} active={active}/>:icon}
 <div className="min-w-0 flex-1"><Heading className="truncate text-[length:calc(14px*var(--fs-scale))] font-bold text-[var(--text)]">{t(title)}</Heading>{!compact && subtitle?<p className="truncate text-[length:calc(11.5px*var(--fs-scale))] text-[var(--text-muted)]">{t(subtitle)}</p>:null}</div>
 {progress?<StatusPill progress={progress}/>:appearance!=='plain'?<span>{String(index+1).padStart(2,'0')}</span>:null}{actions}
 {onRead?<Button size="sm" variant="ghost" onClick={onRead}>{t(reading?'template.clinical.reading':'template.clinical.read')}</Button>:null}</header>
 <div className={compact?'p-4':preferences.density==='spacious'?'p-6':'p-5'}>{accordion&&actions?<div className="mb-3 flex justify-end">{actions}</div>:null}{children}</div></section>;
}
export interface RecordSectionLayoutProps<T extends RecordFormSection> {
 sections:readonly T[];active:string;onActive:(id:string)=>void;isDone:(id:string)=>boolean;
 activeOnly?:boolean;keepMounted?:boolean;showCompletion?:boolean;railAlignment?:'spread'|'start';sizing?:'viewport'|'container';appearance?:'default'|'plain';
 identity?:ReactNode;railHeader?:ReactNode;footer?:ReactNode;renderSection:(section:T)=>ReactNode;
 progress?:Record<string,RecordSectionProgress>;uid?:string;onNext?:()=>void;headingLevel?:2|3;
}
/** All five arrangements share one stable section tree, including across preference changes. */
export function RecordSectionLayout<T extends RecordFormSection>({sections,active,onActive,isDone,activeOnly=false,keepMounted=false,showCompletion=true,railAlignment='spread',sizing='viewport',appearance='default',identity,railHeader,footer,renderSection,progress:provided,uid:hostId,onNext,headingLevel=3}:RecordSectionLayoutProps<T>){
 const generated=useId(),uid=hostId??generated,{preferences}=usePreferences(),{t,direction}=useLocalization();
 const layout=preferences.formNavigation==='rail'?'scroll':preferences.formNavigation,compact=preferences.density==='compact';
 const content=useRef<HTMLDivElement>(null),lock=useRef(0),observed=useRef<string|null>(null),surface=useRef<HTMLDivElement>(null);
 const normalized=sections.map((section,i)=>({...section,index:i+1}));
 const progress=Object.fromEntries(sections.map(section=>[section.id,provided?.[section.id]??{state:isDone(section.id)?'complete':'empty',requiredDone:0,requiredTotal:0,errorCount:0,optional:false,countsKnown:false}])) as Record<string,RecordSectionProgress>;
 const select=(id:string)=>{observed.current=null;lock.current=Date.now()+700;onActive(id);if(layout==='scroll') {const target=document.getElementById(sectionDomId(uid,id));if(target)scrollWithin(target,'start',preferences.reducedMotion);}};
 useEffect(()=>{if(layout==='scroll'&&observed.current===active)return;if(layout!=='scroll')observed.current=null;const target=document.getElementById(sectionDomId(uid,active));if(target && (layout==='scroll'||layout==='accordion'))scrollWithin(target,'start',preferences.reducedMotion);else if(content.current)content.current.scrollTop=0;},[active,layout,uid,preferences.reducedMotion]);
 useEffect(()=>{if(sizing==='container')return;const measure=()=>{if(surface.current)surface.current.style.height=`${Math.max(520,window.innerHeight-surface.current.getBoundingClientRect().top-48)}px`;};measure();window.addEventListener('resize',measure);return()=>window.removeEventListener('resize',measure);},[sizing]);
 const side=layout==='scroll'||layout==='stepper', nav={uid,active,onSelect:select,progress},Heading=headingLevel===2?'h2':'h3';
 return <SectionHeadingLevel.Provider value={headingLevel}><LayoutData.Provider value={{sections:normalized}}><div ref={surface} className="flex min-h-0 min-w-0 flex-1 flex-col gap-3" data-layout={layout} data-sizing={sizing} data-density={preferences.density} data-motion={preferences.reducedMotion?'reduced':'full'} data-appearance={appearance} data-rail-alignment={railAlignment}>
 {identity}{railHeader && <div>{railHeader}</div>}
 <div className={cn('flex min-h-0 flex-1 flex-col',side&&'lg:flex-row lg:gap-4',layout==='tabs'&&'overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)]')}>
 {side?<aside className={cn('hidden shrink-0 overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] lg:block',appearance==='plain'?'w-[170px]':layout==='stepper'?'w-72':'w-60',!showCompletion&&'[&>nav>div]:hidden')}><SectionList {...nav} variant={layout==='stepper'?'stepper':'rail'}/></aside>:null}
 {layout!=='accordion'&&layout!=='wizard'?<SectionTabs {...nav} variant={side?'chips':'tabs'} className={cn('shrink-0 bg-[var(--surface)]',side&&'lg:hidden')}/>:null}
 <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
 {layout==='wizard'?<nav aria-label={t('Form sections')} className="shrink-0 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-3 sm:px-5"><ol role="tablist" className="flex items-start">{normalized.map((section,i)=><li role="presentation" key={section.id} className="relative flex min-w-0 flex-1 flex-col items-center">{i>0?<span aria-hidden="true" className={cn('absolute start-[calc(-50%+18px)] end-[calc(50%+18px)] top-[13px] h-0.5',progress[normalized[i-1]!.id]!.state==='complete'?'bg-[var(--success)]':'bg-[var(--border)]')}/>:null}<button type="button" role="tab" tabIndex={section.id===active?0:-1} aria-controls={`${uid}-panel-${section.id}`} onKeyDown={event=>{let next=i;if(event.key==='Home')next=0;else if(event.key==='End')next=sections.length-1;else if(event.key===(direction==='rtl'?'ArrowLeft':'ArrowRight'))next=(i+1)%sections.length;else if(event.key===(direction==='rtl'?'ArrowRight':'ArrowLeft'))next=(i-1+sections.length)%sections.length;else return;event.preventDefault();select(sections[next]!.id);(event.currentTarget.closest('ol')?.querySelectorAll('button')[next] as HTMLElement|undefined)?.focus();}} aria-selected={section.id===active} aria-label={`${i+1} ${t(section.title)}`} onClick={()=>select(section.id)} className="focus-ring relative flex flex-col items-center gap-1.5 rounded-lg px-1"><StatusGlyph index={i+1} progress={progress[section.id]!} active={section.id===active}/><span className="text-[length:calc(10.5px*var(--fs-scale))]">{t(section.short??section.title)}</span></button></li>)}</ol></nav>:null}
 <div ref={content} className={cn('nex-scrollbar min-h-0 flex-1 overflow-y-auto pb-6',layout==='tabs'&&'bg-[var(--surface-2)] p-3 sm:p-4')} data-scroll-root onScroll={()=>{
 if(layout!=='scroll'||activeOnly||Date.now()<lock.current||!content.current)return;
 const top=content.current.getBoundingClientRect().top;let current:string|undefined=sections[0]?.id;
 for(const section of sections){const node=document.getElementById(sectionDomId(uid,section.id));if(node&&node.getBoundingClientRect().top-top<=120)current=section.id;}
 if(content.current.scrollTop+content.current.clientHeight>=content.current.scrollHeight-4)current=sections.at(-1)?.id;
 if(current&&current!==active){observed.current=current;onActive(current);}
 }}><div className={layout==='accordion'?'overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)]':compact?'space-y-3':'space-y-4'}>
 {sections.map((section,index)=>{const open=section.id===active,visible=layout==='scroll'&&!activeOnly||open;return <section key={section.id} id={sectionDomId(uid,section.id)} data-record-section={section.id} hidden={layout!=='accordion'&&!visible} className={layout==='accordion'&&index>0?'border-t border-[var(--border)]':undefined}>
 {layout==='accordion'?<Heading><button type="button" aria-expanded={open} aria-controls={`${uid}-panel-${section.id}`} onClick={()=>select(section.id)} className={cn('focus-ring flex w-full items-center gap-3 text-start',compact?'px-4 py-2.5':'px-5 py-3.5',open&&'bg-[var(--primary-soft)]')}><StatusGlyph index={index+1} progress={progress[section.id]!} active={open}/><span className="flex-1 text-[length:calc(14px*var(--fs-scale))] font-bold">{t(section.title)}</span><StatusPill progress={progress[section.id]!}/><ChevronDown className={cn('size-4',open&&'rotate-180')}/></button></Heading>:null}
 <div id={`${uid}-panel-${section.id}`} hidden={!visible} role={layout==='tabs'?'tabpanel':undefined} aria-labelledby={layout==='tabs'?`${uid}-tab-${section.id}`:undefined}><AccordionSection.Provider value={layout==='accordion'}>{keepMounted||visible?renderSection(section):null}</AccordionSection.Provider>{layout==='accordion'&&open&&index<sections.length-1?<div className="flex justify-end p-4"><Button size="sm" variant="ghost" onClick={onNext??(()=>select(sections[index+1]!.id))}>{t('Continue to {section}',{section:t(sections[index+1]!.short??sections[index+1]!.title)})}</Button></div>:null}</div>
 </section>;})}</div></div></div></div>
 {footer?<footer>{footer}</footer>:null}</div></LayoutData.Provider></SectionHeadingLevel.Provider>;
}
export {RecordForm,type RecordFormProps,type RecordFormContext} from './record-form';
