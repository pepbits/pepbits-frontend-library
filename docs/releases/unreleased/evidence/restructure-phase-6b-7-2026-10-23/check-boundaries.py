from pathlib import Path
import subprocess,json,hashlib,re
out=Path('docs/releases/unreleased/evidence/restructure-phase-6b-7-2026-10-23')
protected=['desktop-clients/','dummy-api/','Jenkinsfile','deploy/','run.sh','run_all.sh','.github/']
def run(args):
 p=subprocess.run(args,text=True,capture_output=True);return {'command':args,'exitCode':p.returncode,'stdout':p.stdout,'stderr':p.stderr}
results={'protectedDiff':run(['git','diff','--stat','HEAD','--',*protected]),'protectedStatus':run(['git','status','--short','--',*protected]),'whitespace':run(['git','diff','--check'])}
assert not results['protectedDiff']['stdout'] and not results['protectedStatus']['stdout']
forbidden=r'@pepbits/(erp-|ops-ui|auth|platform-ports|workspace-core|ai-client|ai-config|ai-ui|reference-)|desktop-clients|/src/'
results['forbidden']=run(['grep','-rnE',forbidden,'demo-apps/healthcare/src']);assert results['forbidden']['exitCode']==1,results['forbidden']['stdout']
pattern=r'''https?://(?!localhost|127\.0\.0\.1|www\.w3\.org)[a-z0-9.-]+\.[a-z]{2,}|Bearer [A-Za-z0-9]{10}|password\s*[:=]\s*['"][^'"]{4,}'''
scan=run(['grep','-rnP',pattern,'demo-apps/healthcare/src',str(out)])
assert scan['exitCode'] in [0,1];matches=[]
for line in scan['stdout'].splitlines():
 path,number,text=line.split(':',2)
 if path.endswith('.css') and any(host in text for host in ['tailwindcss.com', 'tailwindlabs.com', 'github.com', 'bugzilla.mozilla.org', 'bugs.chromium.org', 'bugs.webkit.org']):reason='Preserved upstream stylesheet license/provenance comment; no runtime request.'
 elif path.endswith('.test.ts') or path.endswith('.test.tsx'):reason='Negative external-origin fixture for transport rejection; no external request.'
 elif 'hl7.org' in text or 'loinc.org' in text:reason='Synthetic FHIR system identifier; not a fetched service.'
 elif 'react.dev' in text:reason='React diagnostic documentation link in retained local test output.'
 else:raise RuntimeError('Unclassified scan match: '+path+':'+number)
 matches.append({'path':path,'line':int(number),'lineSha256':hashlib.sha256(text.encode()).hexdigest(),'reason':reason})
results['externalScan']={'command':scan['command'],'exitCode':scan['exitCode'],'stderr':scan['stderr'],'matchCount':len(matches),'matches':matches}
(out/'boundary-scans.json').write_text(json.dumps(results,indent=2)+'\n')
print('Protected paths unchanged; forbidden output empty;',len(matches),'external-pattern lines classified.')
