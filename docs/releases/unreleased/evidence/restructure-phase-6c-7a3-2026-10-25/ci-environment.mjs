// Verification only: Turbo keeps concurrency=3, while this run owns one Vitest tree.
import {spawnSync} from 'node:child_process';
if (/(?:[/\\]vitest[/\\]vitest\.mjs|[/\\]\.bin[/\\]vitest)$/.test(process.argv[1] ?? '') && process.argv.includes('run')) {
 if (!process.env.ERP7A3_VITEST_LOCKED) {
  const result=spawnSync('flock',['/tmp/erp-phase6c7a3-vitest.lock',process.execPath,...process.argv.slice(1)],{stdio:'inherit',env:{...process.env,ERP7A3_VITEST_LOCKED:'1'}});
  process.exit(result.status??1);
 }
 process.argv.push('--testTimeout=120000','--maxWorkers=2');
 console.log('[phase6c7a3] Serialized Vitest; testTimeout=120000 ms; maxWorkers=2.');
}
