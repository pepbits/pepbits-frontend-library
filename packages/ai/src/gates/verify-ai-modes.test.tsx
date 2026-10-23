import {test,expect} from "vitest";
import {resolve} from "node:path";
import {readFileSync} from "node:fs";
import {gatesForPage,resolveAi} from "../config";
const check=(name:string,condition:boolean,_detail="")=>test(name,()=>expect(condition).toBe(true));
const page = { pageId: "items-a", module: "operations",
  build: { enabled: true, useCases: ["worklist.summarise-selection", "record.explain"] } };
const base = { tenantId: "T", global: {}, modules: {}, pages: {}, useCases: {} };

const before = resolveAi(gatesForPage(base, page, true));
const after = resolveAi(gatesForPage({ ...base, useCases: { "record.explain": { allowed: false } } }, page, true));

check("both use cases resolve to begin with", before.useCases.length === 2, before.useCases.join(", "));
check("the disabled one is gone from the set", !after.useCases.includes("record.explain"), after.useCases.join(", "));
check("the other survives", after.useCases.includes("worklist.summarise-selection"));
check("a set emptied by the gate denies outright",
  resolveAi(gatesForPage({ ...base, useCases: { "record.explain": { allowed: false }, "worklist.summarise-selection": { allowed: false } } }, page, true)).allowed === false);

/* ---- structure ---------------------------------------------------------- */

const source = (file:string) => readFileSync(resolve("src/ui", file), "utf8");
const SURFACES = ["assistant-panel.tsx", "terminal.tsx", "inline-action.tsx"];

for (const file of SURFACES) {
  const text = source(file);
  const resolves = /\bresolveAi\s*\(/.test(text) || /\bgatesForPage\s*\(/.test(text) || /\bgetUseCase\s*\(/.test(text);
  check(`${file} does not resolve access itself`, !resolves, resolves ? "calls a resolver directly" : "");
}
for (const file of SURFACES) {
  const text = source(file);
  const reads = text.includes("useAssistant") || /assistant[.:]/.test(text);
  check(`${file} reads the shared assistant`, reads);
}

const engine = source("use-assistant.ts");
check("the engine is the only place that resolves", /\bresolveAi\s*\(/.test(engine) && /\bgatesForPage\s*\(/.test(engine));
check("terminal builds its command list from the resolved set",
  source("terminal.tsx").includes("assistant.useCases"));
check("inline checks membership rather than re-resolving",
  /assistant\.useCases\.find\(/.test(source("inline-action.tsx")));
check("inline refuses to surface a clinical use case",
  source("inline-action.tsx").includes('category === "clinical"'));


import React from 'react';
import {render,screen,waitFor} from '@testing-library/react';
import {createAiCatalogue} from '../config';
import {createAiClientWithRequest} from '../client';
import {AiTestHost} from '../test/host';
import {USE_CASES,classificationFor} from '../test/catalog';
import {useScreenHost} from '@pepbits/patterns/screen-host';
const client=createAiClientWithRequest(async()=>new Response(JSON.stringify({tenantId:'t',global:{},modules:{},pages:{},useCases:{}})),classificationFor);
const host={client,catalogue:createAiCatalogue(USE_CASES),pages:{'items-a':{pageId:'items-a',module:'operations',title:'Items',build:{enabled:true,useCases:USE_CASES.map(item=>item.id)}}}};
function Action({id}:{id:string}){return <>{useScreenHost().renderInlineAction?.({useCaseId:id})}</>;}
test('the inline surface is mounted through the real ScreenHost slot',async()=>{
 render(<AiTestHost value={host}><Action id="record.explain"/></AiTestHost>);
 expect(await screen.findByRole('button',{name:'Explain this record'})).toBeVisible();
});
test.each(USE_CASES)('$id inline reachability respects its category',async useCase=>{
 render(<AiTestHost value={host}><Action id={useCase.id}/><span>Mounted</span></AiTestHost>);
 await waitFor(()=>expect(screen.getByText('Mounted')).toBeVisible());
 if(useCase.category==='clinical')expect(screen.queryByRole('button',{name:useCase.label})).toBeNull();
 else expect(screen.getByRole('button',{name:useCase.label})).toBeVisible();
});
