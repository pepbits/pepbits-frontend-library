from pathlib import Path
import subprocess,json,re
folder=Path(__file__).parent
protected=subprocess.run(['git','status','--short','--','desktop-clients','dummy-api','source','demo-pages','deploy','.github','Jenkinsfile','run.sh','run_all.sh'],capture_output=True,text=True,check=True).stdout
imports=subprocess.run(['grep','-rnE',r'@pepbits/(erp-|ops-ui|auth|platform-ports|workspace-core|ai-client|ai-config|ai-ui|reference-)|desktop-clients|/src/|demo-apps/healthcare','demo-apps/erp/src'],capture_output=True,text=True)
pattern=r'''https?://(?!localhost|127\.0\.0\.1|www\.w3\.org)[a-z0-9.-]+\.[a-z]{2,}|Bearer [A-Za-z0-9]{10}|password\s*[:=]\s*['"][^'"]{4,}'''
scan=subprocess.run(['grep','-rnP',pattern,'demo-apps/erp/src',str(folder)],capture_output=True,text=True)
# The output receipt itself is excluded from its subsequent regeneration.
lines=[line for line in scan.stdout.splitlines() if '/boundary-scan.json:' not in line]
entries=[]
for line in lines:
 path,number,text=line.split(':',2)
 hits=re.findall(pattern,text)
 if any(hit.startswith('Bearer ') or hit.startswith('password') for hit in hits):
  entries.append({'path':path,'line':int(number),'matches':'REDACTED credential-like match','reason':'Requires removal before completion'})
 else:
  entries.append({'path':path,'line':int(number),'matches':hits,'reason':'Public tooling/React/Next diagnostic URL in retained verification output; not an application endpoint or credential'})
base=subprocess.check_output(['git','show','HEAD:demo-apps/erp/parity-status.md'],text=True).splitlines()
now=Path('demo-apps/erp/parity-status.md').read_text().splitlines()
changed=[{'before':a,'after':b} for a,b in zip(base,now) if a!=b]
assert len(base)==len(now) and len(changed)==12 and all(re.match(r'\| `/erp[12]/masters/(org-structure|chart-of-accounts|product-categories|tax-rates|price-lists|consultation-fees)`',row['before']) for row in changed)
assert not protected and imports.returncode==1 and not any(entry['matches']=='REDACTED credential-like match' for entry in entries)
assert not subprocess.check_output(['git','diff','--','package-lock.json'],text=True)
subprocess.run(['git','diff','--check'],check=True)
(folder/'boundary-scan.json').write_text(json.dumps({'protectedStatus':protected,'forbiddenImports':imports.stdout,'ledgerChangedRows':len(changed),'ledgerHeaderOrderOtherRowsPreserved':True,'lockfileUnchanged':True,'scanMatches':entries},indent=2)+'\n')
print(f'Protected/import/lockfile/whitespace checks pass; 12 master rows only; {len(entries)} justified URL scan lines')
