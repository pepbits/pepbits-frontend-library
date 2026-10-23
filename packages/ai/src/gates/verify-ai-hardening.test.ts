import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {expect,test} from 'vitest';
import {createAiCatalogue} from '../config';
import {useCase} from '../ui/fixtures.test-support';

test('D5 client catalogue contains prompt identifiers and no prompt text',()=>{
  const source=readFileSync(resolve('src/config/use-cases.ts'),'utf8');
  expect(source).not.toMatch(/promptText|systemPrompt/);
  expect(createAiCatalogue([useCase()]).getUseCase('record.explain')?.promptId).toBe('record.explain.v1');
});
test.each([{fields:[]},{fields:['*']},{fields:['private*']}])('invalid retrieval fields $fields are refused when constructing a host catalogue',({fields})=>{
  expect(()=>createAiCatalogue([useCase({reads:[{source:'page-record',fields}]})])).toThrow();
});
test('duplicate host ids are refused',()=>expect(()=>createAiCatalogue([useCase(),useCase()])).toThrow(/Duplicate/));
