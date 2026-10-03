"""Import source pages without modifying reference checkouts. Run once, then review adaptations."""
from pathlib import Path
import json,re,hashlib,shutil
root=Path(__file__).resolve().parents[3]
sources=Path('/home/pepadmin/pb/saas/reference/frontend')
manifest=[]; modules=[]
for variant,front,backend in [('lis1','lis-1/lis-system/frontend','lis-1/lis-system/backend'),('lis2','lis-2/lis-frontend/src','lis-2/lis-backend'),('ris1','ris-1/ris/src','ris-1/ris')]:
 src=sources/front; dest=root/'desktop-clients/packages'/('reference-'+variant)
 (dest/'src').mkdir(parents=True,exist_ok=True)
 sourcefiles=[]
 for folder in ['app','components','lib']:
  for f in (src/folder).rglob('*'):
   if not f.is_file() or f.suffix not in ['.ts','.tsx']:continue
   rel=f.relative_to(src)
   if folder=='app' and (f.name!='page.tsx' or 'login' in f.parts or 'api' in f.parts):continue
   if folder=='components' and f.name.lower()=='shell.tsx':continue
   if variant=='ris1' and folder=='lib' and f.name not in ['client.ts']:continue
   # Standalone authentication is replaced by host-owned context.
   if f.name=='auth.tsx':continue
   text=f.read_text()
   out=dest/'src'/rel;out.parent.mkdir(parents=True,exist_ok=True)
   def alias(m):
    target=dest/'src'/m.group(1)
    import os
    p=os.path.relpath(target,out.parent)
    return "from '"+ ('./'+p if not p.startswith('.') else p)+"'"
   text=re.sub(r"from ['\"]@/([^'\"]+)['\"]",alias,text)
   text=text.replace("import Link from 'next/link';","import {ReferenceLink as Link} from '@pepbits/reference-host';")
   def navigation(m):
    names=m.group(1)
    shared={'useRouter':'useReferenceRouter','usePathname':'useReferencePathname','useSearchParams':'useReferenceSearchParams'}
    parts=[x.strip() for x in names.split(',')];a=[];b=[]
    for n in parts:
     if n in shared:a.append(shared[n]+' as '+n)
     else:b.append(n)
    return ('import {'+', '.join(a)+"} from '@pepbits/reference-host';" if a else '')+('\nimport {'+', '.join(b)+"} from '@pepbits/reference-diagnostics';" if b else '')
   text=re.sub(r"import \{([^}]+)\} from 'next/navigation';",navigation,text)
   out.write_text(text)
   sourcefiles.append({'path':str(f.relative_to(sources)),'sha256':hashlib.sha256(f.read_bytes()).hexdigest()})
 pages=[]; routes=[]
 for f in sorted((dest/'src/app').rglob('page.tsx')):
  parts=[p for p in f.relative_to(dest/'src/app').parts[:-1] if not p.startswith('(')]
  path='/'+ '/'.join(parts); routes.append({'path':path,'file':'./'+str(f.relative_to(dest/'src')).removesuffix('.tsx')})
  if '[' not in path and not path.startswith('/print'):
   title='Dashboard' if path=='/' else ' · '.join(p.replace('-',' ').title() for p in parts)
   pages.append({'id':'reference-'+variant+'-'+('-'.join(parts) or 'dashboard'),'path':path,'title':title,'section':'workspace'})
 pages.sort(key=lambda p:(p['path']!='/',p['path']))
 (dest/'src/routes.json').write_text(json.dumps(routes,indent=2)+'\n')
 deps={'@pepbits/reference-host':'*','@pepbits/reference-diagnostics':'*','@pepbits/ops-ui':'*','lucide-react':'^0.468.0','recharts':'^2.15.4'}
 pkg={'name':'@pepbits/reference-'+variant,'private':True,'version':'0.0.0','type':'module','main':'./src/index.ts','types':'./src/index.ts','exports':{'.':'./src/index.ts','./styles.css':'./src/styles.css'},'dependencies':deps,'peerDependencies':{'react':'>=19'}}
 (dest/'package.json').write_text(json.dumps(pkg,indent=2)+'\n')
 (dest/'tsconfig.json').write_text('{"extends":"../../tsconfig.base.json","include":["src"]}\n')
 (dest/'src/index.ts').write_text("export {DiagnosticModule as Reference"+variant.upper()+"Module} from './module';\n")
 modules.append({'id':'reference-'+variant,'variant':variant,'title':variant.upper(),'shortLabel':variant.upper(),'accent':{'lis1':'#0E7C7B','lis2':'#2F3A8F','ris1':'#1D4E6B'}[variant],'pages':pages})
 backsrc=sources/backend; backdest=root/'dummy-api/diagnostics-source'/variant
 for d in ['src']:
  for f in (backsrc/d).rglob('*'):
   if not f.is_file() or f.suffix not in ['.ts','.tsx']:continue
   if variant=='ris1' and 'components' in f.parts:continue
   if variant=='ris1' and 'app' in f.parts and 'api' not in f.parts:continue
   if variant=='ris1' and f.name=='client.ts':continue
   out=backdest/f.relative_to(backsrc);out.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(f,out)
   sourcefiles.append({'path':str(f.relative_to(sources)),'sha256':hashlib.sha256(f.read_bytes()).hexdigest()})
 for name in ['package.json','package-lock.json','README.md']:
  if (backsrc/name).exists():shutil.copyfile(backsrc/name,backdest/name)
 manifest.append({'module':variant,'files':sourcefiles,'sourcePages':routes})
(root/'desktop-clients/packages/erp-config/src/diagnostic-reference.ts').write_text('/** Imported diagnostic workspaces; API and identity are supplied by the host. */\nexport const DIAGNOSTIC_REFERENCES = '+json.dumps(modules,indent=2)+' as const;\n')
(root/'docs/reference-import/DIAGNOSTICS-SOURCE.json').write_text(json.dumps(manifest,indent=2)+'\n')
print([(m['title'],len(m['pages'])) for m in modules])
