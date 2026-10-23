import type {EntitySchema} from "./page";
export type {EntitySchema, FormFieldSchema, FormSectionSchema, FormOption} from "./page";
export function withSchemaLocalization(schema: EntitySchema): EntitySchema {
    return { ...schema, sections: schema.sections.map(section => ({ ...section, titleKey: `section.${schema.id}.${section.id}.title`, descriptionKey: section.description ? `section.${schema.id}.${section.id}.description` : undefined, fields: section.fields.map(field => ({ ...field, labelKey: `field.${schema.id}.${field.id}.label`, helpKey: field.help ? `field.${schema.id}.${field.id}.help` : undefined, placeholderKey: field.placeholder ? `field.${schema.id}.${field.id}.placeholder` : undefined })) })) };
}
