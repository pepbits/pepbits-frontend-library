// Reproduce the dependency-free source service port with Node 24. No source checkout is modified.
// Usage: node dummy-api/reference-healthcare-suite-import.mjs /path/to/healthcare-suite/backend
import {stripTypeScriptTypes} from 'node:module';
import {readFileSync,writeFileSync,readdirSync,mkdirSync,copyFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const source=process.argv[2];if(!source)throw new Error('Provide the original backend directory');
const target=dirname(fileURLToPath(import.meta.url));
const files=['common/csv.ts','common/query.ts','common/errors.ts','masters/entities.ts','masters/masters.service.ts','patients/patients.service.ts','scheduling/scheduling.service.ts','encounters/eligibility.service.ts','encounters/encounters.service.ts','orders/orders.service.ts','orders/approvals.service.ts','pricing/pricing.service.ts','billing/billing.service.ts','system/system.service.ts'];
const manifest={source:'CarePoint healthcare-suite/backend',adaptations:['Remove Nest dependency injection and replace HTTP exceptions with dependency-free equivalents.','CSV store is separate, branch-partitioned in-memory demo storage; original typed CSV schema and coercion retained.','Actor stamping and authenticated session are supplied by adapter rather than source users.csv.','Input validation, rollback and replay protection are implemented by adapter.','Billing.create validates aggregate stock consumption against its single billing preview; original per-line checks could oversell repeated items.'],files:[]};
for(const file of files){
 const original=readFileSync(join(source,'src',file),'utf8');
 let text=original.replace(/^@Injectable\(\)\s*$/gm,'').replace(/from '@nestjs\/common'/g,"from '../runtime.mjs'");
 text=text.replace(/from '([^']+)'/g,(all,path)=>path.endsWith('.mjs')?all:`from '${path}.mjs'`);
 if(file==='billing/billing.service.ts')text=text.replace('const pv = this.preview(body.encounterId, body.category);',`const pv = this.preview(body.encounterId, body.category);
    // Guard total consumption of repeated item lines against the same preview used to create the bill.
    const quantities = new Map<string, number>();
    for (const line of pv.lines.filter((line: Row) => line.kind === 'item')) quantities.set(line.code, (quantities.get(line.code) ?? 0) + line.qty);
    for (const [code, qty] of quantities) if (this.pricing.catalogEntry(code).row.stockQty < qty) throw new ValidationFailed({ stock: 'Combined quantities exceed available stock' });`);
 text=text.replace(/import \{([^}]+)\}/g,(all,names)=>'import {'+names.split(',').map(name=>name.trim()).filter(name=>!['Row','EntityDef','Injectable','OnApplicationBootstrap'].includes(name)).join(', ')+'}');
 text=stripTypeScriptTypes(text,{mode:'transform'});
 const out=join(target,'reference-healthcare-suite-source',file.replace(/\.ts$/,'.mjs'));mkdirSync(dirname(out),{recursive:true});
 writeFileSync(out,`// Adapted from healthcare-suite/backend/src/${file}. Reproduce with ../reference-healthcare-suite-import.mjs.\n`+text);
 manifest.files.push({path:`src/${file}`,sha256:createHash('sha256').update(original).digest('hex')});
}
mkdirSync(join(target,'reference-healthcare-suite-data'),{recursive:true});
for(const file of readdirSync(join(source,'data')).filter(file=>file.endsWith('.csv'))){copyFileSync(join(source,'data',file),join(target,'reference-healthcare-suite-data',file));manifest.files.push({path:`data/${file}`,sha256:createHash('sha256').update(readFileSync(join(source,'data',file))).digest('hex')});}
writeFileSync(join(target,'reference-healthcare-suite-source-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
