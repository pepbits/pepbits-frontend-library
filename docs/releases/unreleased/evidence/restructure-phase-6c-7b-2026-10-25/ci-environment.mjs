// Keep the requested Turbo concurrency=3 while serializing this run's Vitest trees
// and production Next builds. Re-exec children inherit the lock marker; no tests skip.
import {spawnSync} from 'node:child_process';
const entry=process.argv[1]??'';
const unit=/(?:[/\\]vitest[/\\]vitest\.mjs|[/\\]\.bin[/\\]vitest)$/.test(entry)&&process.argv.includes('run');
const build=/(?:[/\\]next[/\\]dist[/\\]bin[/\\]next|[/\\]\.bin[/\\]next)$/.test(entry)&&process.argv.includes('build');
if((unit||build)&&!process.env.ERP_7B_CHECK_LOCKED) {
 const args=[...process.execArgv,...process.argv.slice(1),...(unit?['--maxWorkers=2','--testTimeout=120000']:[])];
 const result=spawnSync('flock',['/tmp/erp-phase6c7b-check.lock',process.execPath,...args],{stdio:'inherit',env:{...process.env,ERP_7B_CHECK_LOCKED:'1'}});
 if(result.error)throw result.error;
 process.exit(result.status??1);
}
if(unit)console.log('[phase6c7b] One Vitest tree; maxWorkers=2, testTimeout=120000; no assertions removed.');
