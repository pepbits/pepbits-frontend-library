import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root='demo-apps/healthcare/.next/';
const paths=['BUILD_ID','build-manifest.json','routes-manifest.json','required-server-files.json','server/app-paths-manifest.json'];
const files=paths.map(p=>({path:root+p,sha256:createHash('sha256').update(readFileSync(root+p)).digest('hex')}));
writeFileSync(process.argv[2],JSON.stringify({scope:process.argv[3],buildId:readFileSync(root+'BUILD_ID','utf8').trim(),files},null,2)+'\n');
