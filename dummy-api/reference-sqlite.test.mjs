import test from 'node:test';
import assert from 'node:assert/strict';
import ReferenceSqlite from './reference-sqlite.mjs';

test('shared embedded adapter preserves nested rollback and immediate source transactions', async () => {
 const db = new ReferenceSqlite(':memory:');
 try {
  db.exec('CREATE TABLE changes(id INTEGER PRIMARY KEY,value TEXT NOT NULL)');
  await db.hostTransaction(async () => {
   db.prepare('INSERT INTO changes VALUES(?,?)').run(1,'outer');
   assert.throws(() => db.transaction(() => {
    db.prepare('INSERT INTO changes VALUES(?,?)').run(2,'rolled-back');
    throw Error('conflict');
   }).immediate(), /conflict/);
   db.transaction(() => db.prepare('INSERT INTO changes VALUES(?,?)').run(3,'inner')).immediate();
  });
  assert.deepEqual(db.prepare('SELECT id FROM changes ORDER BY id').all().map(r => r.id),[1,3]);
  await assert.rejects(db.hostTransaction(async () => {
   db.transaction(() => db.prepare('INSERT INTO changes VALUES(?,?)').run(4,'nested')).immediate();
   throw Error('outer rollback');
  }), /outer rollback/);
  assert.equal(db.prepare('SELECT count(*) AS n FROM changes').get().n,2);
  assert.throws(() => db.transaction(() => Promise.resolve('unsafe'))(), /hostTransaction/);
  assert.equal(db.depth,0);
 } finally { db.close(); }
});
