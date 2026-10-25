import {DatabaseSync} from 'node:sqlite';
import {mkdirSync, chmodSync} from 'node:fs';
import {dirname} from 'node:path';

/** Single-host transactional audit journal. Values, prompts and credentials never enter it. */
export function createAuditStore(file, {retentionDays = 90, now = Date.now} = {}) {
  if (!Number.isInteger(retentionDays) || retentionDays < 1) throw new Error('Invalid audit retention');
  mkdirSync(dirname(file), {recursive: true, mode: 0o700});
  const db = new DatabaseSync(file);
  chmodSync(file, 0o600);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL,
      tenant TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, status INTEGER NOT NULL, metadata TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS audit_tenant_cursor ON audit(tenant,id);
    CREATE INDEX IF NOT EXISTS audit_expiry ON audit(at);`);
  const insert = db.prepare('INSERT INTO audit(at,tenant,actor,action,status,metadata) VALUES(?,?,?,?,?,?)');
  const keys = values => Array.isArray(values) ? [...new Set(values.filter(value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,100}$/.test(value)))].slice(0,100) : [];
  return {
    append(user, action, status, metadata = {}) {
      if (!user?.tenantId || !user?.id || !/^[a-zA-Z0-9_.:/-]{1,120}$/.test(action)) throw new Error('Invalid audit identity');
      const safe = {};
      for (const key of ['columns','withheld','fieldKeys','filterKeys']) if (metadata[key]) safe[key] = keys(metadata[key]);
      for (const key of ['pageId','useCaseId','provider','via','jobId']) if (typeof metadata[key] === 'string' && /^[a-zA-Z0-9_.:-]{1,100}$/.test(metadata[key])) safe[key] = metadata[key];
      for (const key of ['rows','tokens']) if (Number.isSafeInteger(metadata[key]) && metadata[key] >= 0) safe[key] = metadata[key];
      return Number(insert.run(now(),user.tenantId,user.id,action,status,JSON.stringify(safe)).lastInsertRowid);
    },
    list(tenant, {before = Number.MAX_SAFE_INTEGER, limit = 50} = {}) {
      const count = Math.min(200,Math.max(1,Number(limit)||50));
      return db.prepare('SELECT * FROM audit WHERE tenant=? AND id<? ORDER BY id DESC LIMIT ?').all(tenant,Number(before)||Number.MAX_SAFE_INTEGER,count)
        .map(row => ({...row, metadata: JSON.parse(row.metadata), at: new Date(row.at).toISOString()}));
    },
    prune() { return db.prepare('DELETE FROM audit WHERE at < ?').run(now()-retentionDays*86400000).changes; },
    close() { db.close(); },
  };
}
