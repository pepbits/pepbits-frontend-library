import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
// Build first with VITE_API_URL=/api. The shared launcher starts the unchanged API, `vite preview` and Chromium.
const child=spawn(process.execPath,[fileURLToPath(new URL('../../../tooling/scripts/run-demo-integration.mjs',import.meta.url)),'desktop'],{stdio:'inherit',env:process.env});
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>child.kill(signal));
child.on('exit',code=>{process.exitCode=code??1;});
