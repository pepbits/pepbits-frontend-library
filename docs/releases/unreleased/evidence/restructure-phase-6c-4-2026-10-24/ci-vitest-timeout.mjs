// Test-run environment only: preserve every assertion while allowing host contention.
// NODE_OPTIONS loads this before the Vitest CLI parses its command line.
if (/(?:[/\\]vitest[/\\]vitest\.mjs|[/\\]\.bin[/\\]vitest)$/.test(process.argv[1] ?? '') && process.argv.includes('run')) {
  process.argv.push('--testTimeout=120000');
  console.log('[phase6c4] Vitest testTimeout=120000 ms; all configured files/assertions retained.');
}
