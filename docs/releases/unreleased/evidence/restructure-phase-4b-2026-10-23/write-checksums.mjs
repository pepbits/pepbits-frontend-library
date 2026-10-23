import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const folder=dirname(fileURLToPath(import.meta.url));
const rows=readdirSync(folder).filter(name=>name!=='checksums.sha256').sort().map(name=>`${createHash('sha256').update(readFileSync(join(folder,name))).digest('hex')}  ${name}`);
writeFileSync(join(folder,'checksums.sha256'),rows.join('\n')+'\n');
console.log(`${rows.length} evidence file hashes recorded`);
