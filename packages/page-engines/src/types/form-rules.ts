import type { EntitySchema, FormFieldSchema, FormOption } from './page';
export type FormValues = Record<string,string|number|boolean|string[]>;
export function isFieldVisible(field: FormFieldSchema, values: FormValues): boolean {
  return !field.visibleWhen || field.visibleWhen.equals === values[field.visibleWhen.field];
}
export function isFieldRequired(field: FormFieldSchema, values: FormValues): boolean {
  return isFieldVisible(field,values) && (!!field.required || !!field.requiredWhen && field.requiredWhen.equals === values[field.requiredWhen.field]);
}
export function fieldOptions(field: FormFieldSchema, values: FormValues): FormOption[] {
  return field.optionsByField ? field.optionsByField.values[String(values[field.optionsByField.field])] ?? [] : field.options ?? [];
}
export function updateFormValue(schema: EntitySchema, values: FormValues, id: string, value: FormValues[string]): FormValues {
  const next={...values,[id]:value};
  // Iterate so a dependent lookup chain is cleared consistently in one edit.
  for(let pass=0;pass<schema.sections.flatMap(section=>section.fields).length;pass++) {
    let changed=false;
    for(const field of schema.sections.flatMap(section=>section.fields)) {
      if(!field.optionsByField || !next[field.id])continue;
      if(!fieldOptions(field,next).some(option=>option.value===next[field.id])) {next[field.id]='';changed=true;}
    }
    if(!changed)break;
  }
  return next;
}
export function validateForm(schema: EntitySchema, values: FormValues): Record<string,string> {
  const errors:Record<string,string>={};
  for(const field of schema.sections.flatMap(section=>section.fields)) {
    if(!isFieldVisible(field,values))continue;
    const value=values[field.id];
    const empty=value===undefined||value===null||typeof value==='string'&&!value.trim()||Array.isArray(value)&&!value.length;
    if(isFieldRequired(field,values)&&empty) {errors[field.id]=`${field.label} is required`;continue;}
    if(empty)continue;
    if(field.type==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value)))errors[field.id]='Enter a valid email address';
    if(field.type==='number') {
      const number=Number(value);
      if(!Number.isFinite(number))errors[field.id]=`${field.label} must be a number`;
      else if(field.min!==undefined&&number<field.min)errors[field.id]=`${field.label} must be at least ${field.min}`;
      else if(field.max!==undefined&&number>field.max)errors[field.id]=`${field.label} must be at most ${field.max}`;
    }
    if(field.optionsByField&&!fieldOptions(field,values).some(option=>option.value===value))errors[field.id]='Choose a value for the selected parent field';
    if(field.notBefore && values[field.notBefore] && String(value)<String(values[field.notBefore])) {
      const other=schema.sections.flatMap(section=>section.fields).find(item=>item.id===field.notBefore);
      errors[field.id]=`${field.label} cannot be before ${other?.label ?? field.notBefore}`;
    }
  }
  return errors;
}
