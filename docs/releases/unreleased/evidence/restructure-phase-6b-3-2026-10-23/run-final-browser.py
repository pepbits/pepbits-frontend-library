"""Recorded final check: wait for CI's healthcare build, isolate its output, run HTTP checks."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import time

evidence = Path(__file__).parent
deadline = time.monotonic() + 900
print('Waiting for the final forced healthcare build.', flush=True)
while True:
    log = (evidence / 'ci-force.log').read_text()
    if '@pepbits-demo/healthcare:build: ƒ  (Dynamic)' in log:
        break
    if 'ERROR  run failed' in log or time.monotonic() > deadline:
        raise RuntimeError('Final healthcare build did not complete successfully')
    time.sleep(1)

manifest = json.loads((evidence / 'ci-source.json').read_text())
assert all(hashlib.sha256(Path(item['path']).read_bytes()).hexdigest() == item['sha256'] for item in manifest['files'])
source = Path('demo-apps/healthcare/.next-phase6b3')
destination = Path('demo-apps/healthcare/.next/phase6b3-browser')
assert not destination.exists(), 'Do not overwrite a pre-existing build copy'
shutil.copytree(source, destination)
receipt = {
    'sourceManifest': 'ci-source.json',
    'sourceBase': manifest['baseCommit'],
    'implementationDigest': manifest['implementationDigest'],
    'matchedSourceFiles': len(manifest['files']),
    'mismatches': [],
    'buildId': (destination / 'BUILD_ID').read_text().strip(),
    'buildDir': '.next/phase6b3-browser',
    'scope': 'Isolated byte copy of the successful healthcare build in the final forced CI run. All manifest source hashes match. The isolated copy avoids changing the running server when other CI tasks build.'
}
(evidence / 'browser-build-source.json').write_text(json.dumps(receipt, indent=2) + '\n')
print('Final build copied; starting one local API, Next server and Chromium.', flush=True)
environment = {
    **os.environ,
    'LD_LIBRARY_PATH': str(Path.home() / '.local/opt/pw-libs/root/usr/lib/x86_64-linux-gnu'),
    'HEALTHCARE_BUILD_DIR': '.next/phase6b3-browser',
    'HEALTHCARE_API_NODE': '/home/pepadmin/.local/opt/node-v24.21.0-linux-x64/bin/node',
    'HEALTHCARE_RUNTIME_ARTIFACTS': '/home/pepadmin/pb/repos/saas/lib/pepbits-frontend-library/dummy-api',
    'HEALTHCARE_RESULT': '/tmp/phase6b3-browser-final.json',
    'HEALTHCARE_IDENTITY': '/tmp/phase6b3-identity-final.json',
    'HEALTHCARE_SCREENSHOTS_DIR': '/tmp/phase6b3-final-screenshots',
}
with (evidence / 'integration-final.log').open('w') as output:
    result = subprocess.run(['node', 'demo-apps/healthcare/scripts/integration.mjs'], env=environment, stdout=output, stderr=subprocess.STDOUT)
raise SystemExit(result.returncode)
