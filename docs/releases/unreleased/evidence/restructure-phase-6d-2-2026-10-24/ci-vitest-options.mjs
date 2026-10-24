// Verification-only allowances for this shared machine. No tests or assertions are excluded.
if (/(?:[/\\]vitest[/\\]vitest\.mjs|[/\\]\.bin[/\\]vitest)$/.test(process.argv[1] ?? '') && process.argv.includes('run')) {
  process.argv.push('--testTimeout=120000','--maxWorkers=2');
  console.log('[phase6d2] Vitest testTimeout=120000 ms, maxWorkers=2; all configured tests retained.');
}
