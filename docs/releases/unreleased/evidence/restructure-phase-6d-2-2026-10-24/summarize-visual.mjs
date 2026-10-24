import {readFileSync,writeFileSync} from 'node:fs';
const folder='docs/releases/unreleased/evidence/restructure-phase-6d-2-2026-10-24';
const result=JSON.parse(readFileSync(folder+'/visual-comparison.json','utf8'));
if(!result.generatedAt||result.comparisons.length!==124||result.errors.length||!result.browserClosed)throw new Error('Final source sweep incomplete');
const profiles=[...new Set(result.comparisons.map(row=>row.profile))].map(profile=>{
 const rows=result.comparisons.filter(row=>row.profile===profile);
 return {profile,cases:rows.length,matchedElements:rows.reduce((sum,row)=>sum+row.matchedElements,0),differentElements:rows.reduce((sum,row)=>sum+row.differentElements,0),unpairedSourceElements:rows.reduce((sum,row)=>sum+row.unpairedElements,0),demoOnlyElements:rows.reduce((sum,row)=>sum+row.demoOnly.length,0),differentCases:rows.filter(row=>row.differentElements).map(({path,role,differentElements})=>({path,role,differentElements})),chartCases:Object.fromEntries(['lines','rings','bars'].map(kind=>{const charts=rows.filter(row=>row.chartGeometry.source[kind].length||row.chartGeometry.demo[kind].length);return [kind,{measured:charts.length,matching:charts.filter(row=>row.chartGeometry.matching[kind]).length}];}))};
});
const summary={scope:result.scope,generatedAt:result.generatedAt,pairedCases:result.comparisons.length,renders:result.comparisons.length*2,errors:result.errors,browserClosed:result.browserClosed,metricTolerance:'Geometry within 0.5 CSS px; exact strings for sampled computed styles. These are diagnostic element comparisons, not whole-page pixel acceptance.',profiles,defaultUnpaired:result.comparisons.filter(row=>row.profile==='default'&&row.unpairedElements).map(({path,role,unpairedSource,demoOnly})=>({path,role,unpairedSource,demoOnly}))};
writeFileSync(folder+'/visual-summary.json',JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary,null,2));
