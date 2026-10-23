from pathlib import Path
import subprocess,json,hashlib
E=Path(__file__).resolve().parent
protected=['desktop-clients','dummy-api','Jenkinsfile','deploy','run.sh','run_all.sh','.github']
def cmd(args):
 p=subprocess.run(args,text=True,capture_output=True);return {'exitCode':p.returncode,'stdout':p.stdout,'stderr':p.stderr}
forbidden=r'@pepbits/(erp-|ops-ui|auth|platform-ports|workspace-core|ai-client|ai-config|ai-ui|reference-)|desktop-clients|/src/'
pattern=r'''https?://(?!localhost|127\.0\.0\.1|www\.w3\.org)[a-z0-9.-]+\.[a-z]{2,}|Bearer [A-Za-z0-9]{10}|password\s*[:=]\s*['\"][^'\"]{4,}'''
scan=cmd(['grep','-rnP',pattern,'demo-apps/healthcare/src',str(E)])
items=[]
for line in scan['stdout'].splitlines():
 path,num,text=line.split(':',2);reason='UNREVIEWED'
 if 'tailwindcss.com' in text or 'github.com' in text or 'bugs.webkit.org' in text or 'developer.mozilla.org' in text or 'bugzilla.mozilla.org' in text:reason='Preserved upstream CSS/license/compatibility comment; no network request.'
 elif 'evil.test' in text or 'evil.example' in text or 'external.test' in text:reason='Negative URL fixture in a test; not a runtime endpoint.'
 elif 'example.test' in text or 'example.org' in text or 'example.invalid' in text:reason='Fictional test identifier/negative fixture; not a live service.'
 if 'loinc.org' in text:reason='Synthetic FHIR coding-system identifier; no HTTP request or provider integration.'
 items.append({'path':str(Path(path).relative_to(Path.cwd())) if Path(path).is_absolute() else path,'line':int(num),'lineSha256':hashlib.sha256(text.encode()).hexdigest(),'reason':reason})
result={'protectedDiff':cmd(['git','diff','--name-only','HEAD','--',*protected]),'protectedStatus':cmd(['git','status','--porcelain','--',*protected]),'forbiddenImports':cmd(['grep','-rnE',forbidden,'demo-apps/healthcare/src']),'whitespace':cmd(['git','diff','--check']),'urlCredentialScan':{'exitCode':scan['exitCode'],'matches':items}}
(E/'boundary-scans.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'matches':len(items),'unreviewed':[x for x in items if x['reason']=='UNREVIEWED'],'protectedDiff':result['protectedDiff']['stdout'],'forbidden':result['forbiddenImports']['stdout']}))
assert result['protectedDiff']['exitCode']==0 and not result['protectedDiff']['stdout']
assert result['protectedStatus']['exitCode']==0 and not result['protectedStatus']['stdout']
assert result['forbiddenImports']['exitCode']==1 and not result['forbiddenImports']['stdout']
assert result['whitespace']['exitCode']==0
assert scan['exitCode'] in (0,1) and not scan['stderr']
assert all(item['reason']!='UNREVIEWED' for item in items)
