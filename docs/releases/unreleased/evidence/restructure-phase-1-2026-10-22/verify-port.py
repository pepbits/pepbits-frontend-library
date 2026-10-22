"""Read-only source-parity and isolation evidence; run from the repository root."""
from pathlib import Path
import hashlib
import json
import subprocess

old = Path('desktop-clients/packages/tokens/src')
new = Path('packages/tokens/src')
assets = sorted(path for path in old.rglob('*') if path.is_file())
for path in assets:
    assert path.read_bytes() == (new / path.relative_to(old)).read_bytes(), str(path)
print(f'PASS byte-identical token assets: {len(assets)} files (2 CSS, 8 WOFF2, 2 licenses, 1 provenance)')

source = Path('desktop-clients/packages/erp-config/src/i18n.ts').read_text()
core = source[source.index('export const LANGUAGE_OPTIONS'):source.index('export const LANGUAGE_LOCALES')]
assert core.replace('const dictionaries:', 'export const CORE_CATALOG:') in Path('packages/i18n/src/core.ts').read_text()
print('PASS core LANGUAGE_OPTIONS and 18-key dictionaries copied verbatim in all 4 languages')
assert Path('desktop-clients/packages/erp-config/src/preference-policy.ts').read_bytes() == Path('packages/preferences/src/preference-policy.ts').read_bytes()
print('PASS preference-policy.ts copied byte-for-byte')

manifest = json.loads(Path('docs/releases/unreleased/manifest-restructure-phase-1-2026-10-22.json').read_text())
for entry in manifest['files']:
    assert hashlib.sha256(Path(entry['path']).read_bytes()).hexdigest() == entry['sha256'], entry['path']
print(f"PASS source manifest: {len(manifest['files'])} file hashes match the working tree")

protected = ['desktop-clients', 'dummy-api', 'Jenkinsfile', 'deploy', 'run.sh', 'run_all.sh', '.github']
for command in [
    ['git', 'diff', '--stat', '--', *protected],
    ['git', 'status', '--short', 'desktop-clients'],
    ['git', 'status', '--short', '--', *protected],
    ['git', 'diff', '--check'],
]:
    result = subprocess.run(command, capture_output=True, text=True, check=True)
    assert not result.stdout and not result.stderr, result.stdout + result.stderr
    print(f"PASS {' '.join(command)}: exit 0, 0 output bytes")
assert not Path('desktop-clients/AGENTS.md').exists()
print('PASS desktop-clients/AGENTS.md is absent')
