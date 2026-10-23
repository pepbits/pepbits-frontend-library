/** Application-neutral page contracts. Rendering lives in page engines; data stays serializable. */
export type TemplateEngine = "master" | "list" | "order" | "booking" | "case" | "result" | "finance" | "reconcile" | "report" | "dashboard" | "entity" | "admin";
export type TemplateLayout = "rail" | "tabs" | "wizard";
export type TemplateView = "table" | "cards" | "board" | "timeline" | "matrix" | "document";
export type TemplateValue = string | number | boolean;
export interface TemplateField {id:string;label:string;type:"text"|"email"|"number"|"date"|"time"|"select"|"textarea"|"checkbox";required?:boolean;options?:Array<{value:string;label:string}>;min?:number}
export interface TemplateSection {id:string;title:string;fields:TemplateField[]}
export interface TemplateColumn {key:string;label:string;type?:"text"|"number"|"money"|"status"|"date"}
export interface TemplateLine {id:string;description:string;quantity:number;price:number;debit:number;credit:number;result:string;reference:string;checked:boolean}
export interface TemplateDocument {id:string;version:number;values:Record<string,TemplateValue>;lines:TemplateLine[];rows:Array<Record<string,TemplateValue>>}
export interface TemplateConfiguration {
 resources?:Array<{value:string;label:string}>;
 slots?:Array<{start:string;end:string;available?:boolean}>;
 scheduleDays?:Array<{value:string;label:string}>;
 capacity?:Record<string,number>;
 unavailable?:Record<string,string[]>;
 roles?:string[];
}
export interface PageTemplateDefinition {configuration?:TemplateConfiguration;id:string;group:string;engine:TemplateEngine;title:string;description:string;layout:TemplateLayout;view:TemplateView;sections:TemplateSection[];columns:TemplateColumn[];stages:string[];tags:string[];editable:boolean;designFamily?:"registry"}
