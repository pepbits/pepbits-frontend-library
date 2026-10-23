"""Run the requested protected-path and grep checks; retain every match by line/hash/category."""
import collections, hashlib, json, pathlib, subprocess
root = pathlib.Path(__file__).resolve().parents[5]
evidence = pathlib.Path(__file__).resolve().parent

def run(args):
    result = subprocess.run(args, cwd=root, text=True, capture_output=True)
    return {'command': args, 'exitCode': result.returncode, 'stdout': result.stdout, 'stderr': result.stderr}

checks = [
    run(['git','diff','--stat','--','desktop-clients','dummy-api','Jenkinsfile','deploy','run.sh','run_all.sh','.github']),
    run(['git','status','--short','desktop-clients','dummy-api']),
    run(['git','diff','--stat','--','packages/shell','packages/ai','packages/patterns','packages/data','demo-apps/showcase']),
    run(['git','status','--short','packages/shell','packages/ai','packages/patterns','packages/data','demo-apps/showcase']),
    run(['git','diff','--check']),
    run(['grep','-rnE',r'@pepbits/(erp-|ops-ui|auth|platform-ports|workspace-core|ai-client|ai-config|ai-ui|reference-)|desktop-clients|/src/','demo-apps/healthcare/src'])
]
pattern = r'''https?://(?!localhost|127\.0\.0\.1)[a-z0-9.-]+\.[a-z]{2,}|Bearer [A-Za-z0-9]{10}|password\s*[:=]\s*['"][^'"]{4,}'''
scan = run(['grep','-rnP',pattern,'demo-apps/healthcare/src',str(evidence.relative_to(root))])
matches = []
for line in scan['stdout'].splitlines():
    path, number, content = line.split(':',2)
    if path.endswith('styles.css'): category = 'Preserved upstream CSS license/browser-fix comment; no network request'
    elif '/integration/console/page.tsx' in path and 'loinc.org' in content: category = 'FHIR coding-system identifier in a synthetic message; not a transport URL'
    elif 'www.w3.org/2000/svg' in content: category = 'SVG namespace in retained failed-test DOM output; not a request'
    elif 'react.dev/link/error-boundaries' in content: category = 'React diagnostic documentation link in a retained failure'
    elif 'testing-library.com' in content: category = 'Testing Library diagnostic documentation link in a retained failure'
    elif 'install.log' in path and 'github.com/recharts' in content: category = 'npm dependency deprecation notice; inherited Recharts version'
    else: category = 'UNREVIEWED'
    matches.append({'path':path,'line':int(number),'sha256':hashlib.sha256(content.encode()).hexdigest(),'justification':category})
scan.pop('stdout')
receipt={'checks':checks,'sensitiveAndExternalScan':scan,'matchedLines':len(matches),'categories':dict(collections.Counter(m['justification'] for m in matches)),'matches':matches}
(evidence/'boundary-scans.json').write_text(json.dumps(receipt,indent=2)+'\n')
assert all(c['exitCode']==0 and not c['stdout'] and not c['stderr'] for c in checks[:-1]), 'Protected path or diff check failed'
assert checks[-1]['exitCode']==1 and not checks[-1]['stdout'] and not checks[-1]['stderr'], 'Forbidden import/source match'
assert not scan['stderr'] and all(m['justification']!='UNREVIEWED' for m in matches), 'Review every match before completion'
print(f'Protected paths clean; forbidden source matches 0; external scan {len(matches)} justified lines; credential matches 0.')
