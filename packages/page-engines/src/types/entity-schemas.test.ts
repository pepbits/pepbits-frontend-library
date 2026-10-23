import {test,expect} from 'vitest';
import {withSchemaLocalization,type EntitySchema} from './index';
test('localization derives presentation keys without changing schema values or mutating the host definition',()=>{
 const schema:EntitySchema={id:'item',singular:'Item',plural:'Items',description:'',sections:[{id:'main',title:'Main',description:'Details',fields:[{id:'name',label:'Name',type:'text',help:'Help',placeholder:'Enter a name',defaultValue:'Record A'}]}]};
 const localized=withSchemaLocalization(schema);
 expect(localized.sections[0]).toMatchObject({titleKey:'section.item.main.title',descriptionKey:'section.item.main.description'});
 expect(localized.sections[0]!.fields[0]).toMatchObject({labelKey:'field.item.name.label',helpKey:'field.item.name.help',placeholderKey:'field.item.name.placeholder',defaultValue:'Record A'});
 expect(schema.sections[0]!.fields[0]).not.toHaveProperty('labelKey');
});
