from pathlib import Path
import json,re
out=Path(__file__).parent
ci=re.sub(r'\x1b\[[0-9;]*m','',(out/'ci-final.log').read_text())
workspaces={}
for name,kind,count in re.findall(r'^(@pepbits[^\s]+):test:\s+(Test Files|Tests)\s+(\d+) passed',ci,re.M):
 workspaces.setdefault(name,{})['files' if kind=='Test Files' else 'tests']=int(count)
assert '30 successful, 30 total' in ci and '0 cached, 30 total' in ci
assert not re.search(r'\d+ (failed|skipped)',ci)
def browser(name):
 d=json.loads((out/name).read_text());c=d['checks'];return {'workflows':len(d['flows']),'surgisuiteWorkflows':sum('surgisuite' in f['id'] for f in d['flows']),'routes':len(c),'surgisuiteRoutes':sum(x['route'].startswith('/surgisuite') for x in c),'rcmPresentationChecks':len(d['rcmPresentation']),'routeFailures':sum(bool(x.get('failure')) for x in c),'axeViolations':sum(len(x.get('violations',[])) for x in c),'pageAxeViolations':sum(len(x.get('pageViolations',[])) for x in c),'incompleteAxeRuleResults':sum(x.get('incomplete',0) for x in c),'javascriptErrors':len(d['errors']),'consoleErrors':len(d['consoleErrors']),'unexpectedHttpErrors':len(d['responses'])}
result={'ci':{'command':'npm run ci -- --concurrency=1','environment':'environment.json','tasks':30,'cached':0,'tests':sum(x['tests'] for x in workspaces.values()),'files':sum(x['files'] for x in workspaces.values()),'skippedTests':0,'skippedFiles':0,'toolingTests':int(re.search(r'# tests (\d+)',ci)[1]),'typechecks':len(set(re.findall(r'^(@pepbits\S+):typecheck: > .*typecheck',ci,re.M))),'builds':len(set(re.findall(r'^(@pepbits\S+):build: > .*build',ci,re.M))),'workspaces':workspaces},'surgisuite':{'originalTests':20,'originalFiles':1,'additionalBehaviorTests':18,'additionalTransportRouteTests':26,'routeProfiles':36,'routePatterns':9,'sidebarDestinations':8},'fullHttp':browser('browser-final.json'),'postCiHttp':browser('browser-post-ci.json')}
for key,filename in [('shellBrowser','shell-browser.log'),('docs','docs-final.log')]:
 text=(out/filename).read_text()
 if key=='docs':result[key]={'files':int(re.search(r'(\d+) documentation files',text)[1])}
 else:result[key]={'tests':int(re.search(r'Tests\s+(\d+) passed',text)[1]),'files':int(re.search(r'Test Files\s+(\d+) passed',text)[1])}
(out/'summary.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k!='ci'},indent=2));print('CI:',result['ci']['tests'],'tests in',result['ci']['files'],'files')
