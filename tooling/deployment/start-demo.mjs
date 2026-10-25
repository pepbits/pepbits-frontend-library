// Copied into the immutable release; resolves every path beside this file.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const demo=process.argv[2]??'showcase';
const manifest=JSON.parse(readFileSync(new URL('./release.json',import.meta.url)));
if(!manifest.demos.includes(demo))throw Error('Unknown packaged demo: '+demo);
if(demo==='desktop'){
 const {createDesktopServer}=await import('./desktop-server.mjs');
 const server=await createDesktopServer(fileURLToPath(new URL('./desktop',import.meta.url)));
 server.listen(Number(process.env.PORT??3410),process.env.HOSTNAME??'127.0.0.1');
 for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{server.close();server.closeAllConnections();});
}else await import(`./demos/${demo}/demo-apps/${demo}/server.js`);
