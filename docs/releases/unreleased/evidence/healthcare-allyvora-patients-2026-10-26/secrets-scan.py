import subprocess,re,pathlib,json
paths=subprocess.check_output(['git','ls-files','--modified','--others','--exclude-standard','-z'],text=True).split('\0')
patterns=[r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',r'\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b',r'\bAKIA[A-Z0-9]{16}\b',r'\bsk-(?:proj-)?[A-Za-z0-9_-]{30,}\b',r'\bxox[baprs]-[A-Za-z0-9-]{20,}\b',r'\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b']
secrets=re.findall(r'password:\s*"([^"\n]+)"',pathlib.Path('mock-api/server.mjs').read_text())
findings=[]
for s in paths:
 p=pathlib.Path(s)
 if not s or not p.is_file(): continue
 text=p.read_text(errors='ignore')
 if any(re.search(pat,text) for pat in patterns) or any(value in text for value in secrets if len(value)>=8):findings.append(s)
result={'scope':'Changed and untracked review files; private keys, known token prefixes, JWTs and actual shared fixture credentials; values never emitted','files':len([p for p in paths if p]),'findings':findings}
print(json.dumps(result,indent=2))
raise SystemExit(bool(findings))
