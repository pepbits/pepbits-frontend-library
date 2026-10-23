import type {DesignerDefinition,DesignerValues} from './dcp-designer';
export type DesignerStatus='draft'|'review'|'approved'|'published'|'retired';
export interface DesignerBinding {entityType:string;trigger:string}
export interface DesignerEntity {id:string;entityType:string;label:string;triggers:string[]}
export interface DesignerRelease {id:string;recordId:string;version:number;definition:DesignerDefinition;publishedAt:string;actor:string;retired?:boolean}
export interface DesignerAudit {action:string;at:string;actor:string;comment:string;revision:number}
export interface DesignerAnswer {id:string;releaseId:string;entityId:string;revision:number;values:DesignerValues;updatedAt:string;updatedBy:string;status:'draft'|'submitted'}
export interface DesignerRuntime {releases:DesignerRelease[];entities:DesignerEntity[];answer?:DesignerAnswer|null;answerHistory?:DesignerAnswer[]}
