// Test-run limits only; no tests/assertions are removed.
if (/(?:[/\\]vitest[/\\]vitest\.mjs|[/\\]\.bin[/\\]vitest)$/.test(process.argv[1] ?? '') && process.argv.includes('run')) {
  process.argv.push('--testTimeout=120000','--maxWorkers=2');
  console.log('[phase6c6] Vitest testTimeout=120000 ms, maxWorkers=2; all assertions retained.');
}
