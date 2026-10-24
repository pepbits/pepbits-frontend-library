import hashlib,json,pathlib,re,subprocess
root=pathlib.Path('.');folder=root/'docs/releases/unreleased/evidence/restructure-phase-6c-1-2026-10-23'
protected=['desktop-clients','dummy-api','Jenkinsfile','deploy','run.sh','run_all.sh','.github']
def run(args):
 result=subprocess.run(args,capture_output=True,text=True)
 return {'exitCode':result.returncode,'output':result.stdout.strip(),'stderr':result.stderr.strip()}
imports=run(['grep','-rnE',r'@pepbits/(erp-|ops-ui|auth|platform-ports|workspace-core|ai-client|ai-config|ai-ui|reference-)|desktop-clients|/src/|demo-apps/healthcare','demo-apps/erp/src'])
pattern=r'''https?://(?!localhost|127\.0\.0\.1|www\.w3\.org)[a-z0-9.-]+\.[a-z]{2,}|Bearer [A-Za-z0-9]{10}|password\s*[:=]\s*['\"][^'\"]{4,}'''
scan=run(['grep','-rnP',pattern,'demo-apps/erp/src',str(folder)])
justified=[]
for line in scan['output'].splitlines():
 path,number,content=line.split(':',2)
 if path.endswith('check-boundaries.py'):reason='Scanner allowlist for public tool documentation; no credential or application request.'
 elif 'https://react.dev/link/wrap-tests-with-act' in content:reason='React test diagnostic documentation link; no credential or application request.'
 elif 'https://nextjs.org/telemetry' in content:reason='Next build diagnostic documentation link; no application endpoint or credential.'
 elif 'https://nextjs.org/docs/' in content:reason='Next build diagnostic documentation link; no application endpoint or credential.'
 else:raise RuntimeError('Review URL/credential match at '+path+':'+number)
 justified.append({'path':path,'line':int(number),'sha256':hashlib.sha256(content.encode()).hexdigest(),'reason':reason})
result={'protectedDiff':run(['git','diff','--name-only','HEAD','--',*protected]),'protectedStatus':run(['git','status','--porcelain','--',*protected]),'forbiddenImports':imports,'whitespace':run(['git','diff','--check']),'urlCredentialMatchingLines':len(justified),'justifiedMatches':justified,'credentialMatches':0}
(folder/'boundary-scans.json').write_text(json.dumps(result,indent=2)+'\n')
assert not result['protectedDiff']['output'] and not result['protectedStatus']['output']
assert imports['exitCode']==1 and not imports['output']
assert result['whitespace']['exitCode']==0
print(json.dumps({k:v for k,v in result.items() if k!='justifiedMatches'},indent=2))
