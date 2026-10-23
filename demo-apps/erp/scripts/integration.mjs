import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const child=spawn(process.execPath,[fileURLToPath(new URL('../../../tooling/scripts/run-demo-integration.mjs',import.meta.url)),'erp'],{stdio:'inherit',env:process.env});
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>child.kill(signal));
child.on('exit',code=>{process.exitCode=code??1;});
