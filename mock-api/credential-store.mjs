import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,renameSync,chmodSync,openSync,closeSync,fsyncSync} from 'node:fs';
import {dirname} from 'node:path';

/** The operator owns the master key outside the data directory. This is not a vault. */
export function createCredentialStore(file, keyFile) {
  const key = readFileSync(keyFile);
  if (key.length !== 32) throw new Error('Credential master key must contain 32 bytes');
  const save = value => {
    mkdirSync(dirname(file),{recursive:true,mode:0o700});
    const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',key,iv);
    const data=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
    const payload=JSON.stringify({version:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')});
    const temporary=`${file}.${process.pid}.tmp`;
    const fd=openSync(temporary,'w',0o600);
    try {writeFileSync(fd,payload);fsyncSync(fd);} finally {closeSync(fd);}
    renameSync(temporary,file);chmodSync(file,0o600);
    const directory=openSync(dirname(file),'r');try {fsyncSync(directory);} finally {closeSync(directory);}
  };
  return {save, load() {
    let raw;try {raw=JSON.parse(readFileSync(file,'utf8'));} catch(error) {if(error.code==='ENOENT')return {};throw error;}
    if(raw.version!==1) {save(raw);return raw;} // Migrate once; never create another plaintext copy.
    const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(raw.iv,'base64'));decipher.setAuthTag(Buffer.from(raw.tag,'base64'));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(raw.data,'base64')),decipher.final()]).toString('utf8'));
  }};
}
