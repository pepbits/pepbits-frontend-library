export type TemplateValue = string | number | boolean;
export interface TemplateField {id:string;label:string;type:"text"|"email"|"number"|"date"|"time"|"select"|"textarea"|"checkbox";required?:boolean;options?:Array<{value:string;label:string}>;min?:number}
export interface TemplateSection {id:string;title:string;fields:TemplateField[]}
