import {readFileSync,writeFileSync} from 'node:fs';
const folder='docs/releases/unreleased/evidence/restructure-phase-6d-2026-10-24';
const read=path=>JSON.parse(readFileSync(path,'utf8'));
const final=read('docs/releases/unreleased/manifest-restructure-phase-6d-2026-10-24.json');
const changes=before=>{
 const previous=new Map(before.files.map(file=>[file.path,file.sha256]));
 const current=new Map(final.files.map(file=>[file.path,file.sha256]));
 return [...new Set([...previous.keys(),...current.keys()])].sort().filter(path=>previous.get(path)!==current.get(path));
};
const isImplementation=path=>!path.endsWith('.md')&&!path.startsWith('docs/');
const ciChanges=changes(read(folder+'/ci-final-source.json'));
const browserChanges=changes(read(folder+'/ci-school-final-source.json')).filter(path=>isImplementation(path)&&(!path.startsWith('demo-apps/')||path.startsWith('demo-apps/school/')));
const result={capturedAt:new Date().toISOString(),finalDigest:final.implementationDigest,ciSource:'ci-final-source.json',ciChanges,ciImplementationChanges:ciChanges.filter(isImplementation),browserSource:'ci-school-final-source.json',browserImplementationChanges:browserChanges,scope:'Browser comparison covers root configuration, public packages, tooling and school. Other demo changes are outside the school artifact. CI comparison covers the complete manifest. Release/evidence files are excluded from both manifests.'};
writeFileSync(folder+'/final-source-comparison.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
if(result.ciImplementationChanges.length||browserChanges.length)process.exitCode=1;
