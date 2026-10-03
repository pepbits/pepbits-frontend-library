/** Compiled into each client so an older native build requests its own manifest. */
export const DOCUMENTATION_RELEASE = '2026-10-02-medslot-reference-import';
export interface GuideSection {id:string;title:string;paragraphs:string[]}
export interface DocumentationGuide {
 pageId:string;module:string;title:string;revision:number;status:'reference'|'authored';
 language:string;requestedLanguage:string;reviewStatus:string;translationStatus?:'source'|'current'|'incomplete'|'outdated';sourceHash?:string;translationHash?:string;sections:GuideSection[];
 fields:Array<{id:string;label:string;type:string;required:boolean;help:string;rules:string[]}>;
 tour:Array<{target:string;title:string;text:string}>;
}
export interface DocumentationRelease {id:string;version:string;date:string;type:'release'|'patch';parentId?:string;appliesTo?:string;title:string;summary:string;pageIds:string[];guidePageIds?:string[];sections?:GuideSection[];knownIssues:string[]}
export interface DocumentationChange {id:string;revision:number;releaseId:string;pageId:string;sectionId:string;category:string;title:string;summary:string;requiresAcknowledgment:boolean;readAt:string|null;dismissedAt:string|null;acknowledgedAt:string|null}
export interface DocumentationIndex {releaseId:string;language:string;pages:Array<Pick<DocumentationGuide,'pageId'|'module'|'title'|'status'>>;releases:DocumentationRelease[];changes:DocumentationChange[];unread:number}
