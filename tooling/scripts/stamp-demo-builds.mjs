import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {demos} from '../services.mjs';
if(process.env.NEXT_PUBLIC_SETTLE_API_URL!=='/settle-api'||process.env.NEXT_PUBLIC_CAREGRID_API_URL!=='/caregrid-api')throw Error('Test-site builds require same-origin billing and scheduling proxies');
// Run immediately after the CI build with the same explicit public API configuration.
for(const demo of Object.keys(demos)){
 const api=process.env[demo==='desktop'?'VITE_API_URL':'NEXT_PUBLIC_API_URL'];
 if(api!=='/api')throw Error('Test-site builds require explicit /api for every browser');
 const dir=`demo-apps/${demo}/${demo==='desktop'?'dist':'.next'}`;
 if(!existsSync(`${dir}/${demo==='desktop'?'index.html':'BUILD_ID'}`))throw Error('Missing build: '+demo);
 if(demo!=='desktop'&&JSON.parse(readFileSync(dir+'/required-server-files.json')).config.output!=='standalone')throw Error('Missing standalone config: '+demo);
 writeFileSync(dir+'/BUILD_API',api+'\n');
}
