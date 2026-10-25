import { Body, ConflictException, Controller, Delete, Get, Injectable, Param, Post, Put, Query } from '@nestjs/common';
import { Db } from '../db/database.service';
import { CurrentUser, Roles, SessionUser } from '../common/auth';
import { bad, must, paging } from '../common/util';
import { hashPassword } from '../common/crypto';
import { EntityDef, REGISTRY, registryByKey } from './registry';

@Injectable()
export class MastersService {
  constructor(private readonly db: Db) {}

  entity(key: string): EntityDef {
    return must(registryByKey.get(key), `Master '${key}'`);
  }

  private selectCols(e: EntityDef) {
    const cols = ['t.id', 't.created_at', 't.updated_at'];
    for (const f of e.fields) {
      if (f.type === 'password') continue;
      cols.push(`t.${f.name}`);
      if (f.type === 'ref') {
        const r = registryByKey.get(f.ref!)!;
        cols.push(`(SELECT ${r.display} FROM ${r.table} WHERE id = t.${f.name}) AS ${f.name}__label`);
      }
    }
    return cols.join(', ');
  }

  private where(e: EntityDef, q: any) {
    const conds: string[] = [];
    const params: any[] = [];
    for (const f of e.fields) {
      const v = q[f.name];
      if (v !== undefined && v !== '' && f.type !== 'password') {
        conds.push(`t.${f.name} = ?`);
        params.push(v);
      }
    }
    if (q.q) {
      const text = e.fields.filter((f) => ['text', 'textarea', 'select'].includes(f.type));
      if (text.length) {
        conds.push(`(${text.map((f) => `t.${f.name} LIKE ?`).join(' OR ')})`);
        text.forEach(() => params.push(`%${q.q}%`));
      }
    }
    return { sql: conds.length ? `WHERE ${conds.join(' AND ')}` : '', params };
  }

  list(key: string, q: any) {
    const e = this.entity(key);
    const { page, pageSize, offset } = paging(q);
    const w = this.where(e, q);
    const sortField = e.fields.find((f) => f.name === q.sort && f.type !== 'password')?.name;
    const order = sortField ? `t.${sortField} ${q.dir === 'desc' ? 'DESC' : 'ASC'}` : e.fields.some((f) => f.name === 'sort_order') ? 't.sort_order, t.id' : 't.id';
    const total = this.db.get<{ c: number }>(`SELECT COUNT(*) c FROM ${e.table} t ${w.sql}`, ...w.params)!.c;
    const data = this.db.all(`SELECT ${this.selectCols(e)} FROM ${e.table} t ${w.sql} ORDER BY ${order} LIMIT ? OFFSET ?`, ...w.params, pageSize, offset);
    return { data, total, page, pageSize };
  }

  options(key: string, q: any) {
    const e = this.entity(key);
    const w = this.where(e, q);
    const hasActive = e.fields.some((f) => f.name === 'active');
    const cond = hasActive && !q.all ? (w.sql ? `${w.sql} AND t.active = 1` : 'WHERE t.active = 1') : w.sql;
    return this.db.all(`SELECT t.id, (SELECT ${e.display} FROM ${e.table} x WHERE x.id = t.id) AS label FROM ${e.table} t ${cond} ORDER BY label LIMIT 1000`, ...w.params);
  }

  get(key: string, id: number) {
    const e = this.entity(key);
    return must(this.db.get(`SELECT ${this.selectCols(e)} FROM ${e.table} t WHERE t.id = ?`, id), e.label);
  }

  private clean(e: EntityDef, body: any, creating: boolean) {
    const row: Record<string, any> = {};
    for (const f of e.fields) {
      if (!(f.name in body)) {
        if (creating && f.default !== undefined) row[f.name] = f.default;
        continue;
      }
      let v = body[f.name];
      if (f.type === 'password') {
        if (v) row.password_hash = hashPassword(String(v));
        continue;
      }
      if (v === '' || v === undefined) v = null;
      if (v !== null) {
        if (f.type === 'number' || f.type === 'ref') {
          v = Number(v);
          if (Number.isNaN(v)) bad(`${f.label} must be a number`);
        } else if (f.type === 'bool') v = v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0;
        else if (f.type === 'select' && f.options && !f.options.includes(v)) bad(`${f.label} must be one of ${f.options.join(', ')}`);
        else v = String(v);
      }
      row[f.name] = v;
    }
    for (const f of e.fields.filter((x) => x.required && x.type !== 'password')) {
      if (creating ? row[f.name] == null : f.name in row && row[f.name] == null) bad(`${f.label} is required`);
    }
    return row;
  }

  private guard<T>(fn: () => T): T {
    try {
      return fn();
    } catch (err: any) {
      const msg = String(err?.message || err);
      if (msg.includes('UNIQUE')) throw new ConflictException('A record with the same code already exists');
      if (msg.includes('FOREIGN KEY')) throw new ConflictException('Record is referenced by other data – deactivate it instead of deleting');
      throw err;
    }
  }

  create(key: string, body: any, user: SessionUser) {
    const e = this.entity(key);
    const row = this.clean(e, body, true);
    if (key === 'users' && !row.password_hash) bad('Password is required for a new user');
    const id = this.guard(() => this.db.tx(() => {
      if (key === 'report_templates' && row.is_default) this.db.run('UPDATE m_report_templates SET is_default = 0');
      const newId = this.db.insert(e.table, row);
      this.db.audit(user.id, 'CREATE', e.table, newId, { ...row, password_hash: undefined });
      return newId;
    }));
    return this.get(key, id);
  }

  update(key: string, id: number, body: any, user: SessionUser) {
    const e = this.entity(key);
    this.get(key, id);
    const row = this.clean(e, body, false);
    this.guard(() => this.db.tx(() => {
      if (key === 'report_templates' && row.is_default) this.db.run('UPDATE m_report_templates SET is_default = 0 WHERE id <> ?', id);
      this.db.update(e.table, id, { ...row, updated_at: new Date().toISOString().replace('T', ' ').slice(0, 19) });
      this.db.audit(user.id, 'UPDATE', e.table, id, { ...row, password_hash: undefined });
    }));
    return this.get(key, id);
  }

  remove(key: string, id: number, user: SessionUser) {
    const e = this.entity(key);
    this.guard(() => this.db.run(`DELETE FROM ${e.table} WHERE id = ?`, id));
    this.db.audit(user.id, 'DELETE', e.table, id);
    return { ok: true };
  }
}

@Controller('masters')
export class MastersController {
  constructor(private readonly svc: MastersService, private readonly db: Db) {}

  @Get('meta')
  meta() {
    return REGISTRY;
  }

  @Get('settings/all')
  settings() {
    return Object.fromEntries(this.db.all('SELECT key, value FROM settings').map((r) => [r.key, r.value]));
  }

  @Put('settings/all')
  @Roles('ADMIN')
  saveSettings(@Body() body: Record<string, string>, @CurrentUser() u: SessionUser) {
    for (const [k, v] of Object.entries(body)) {
      this.db.run('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', k, v);
    }
    this.db.audit(u.id, 'UPDATE', 'settings', null, body);
    return this.settings();
  }

  @Get(':key')
  list(@Param('key') key: string, @Query() q: any) {
    return this.svc.list(key, q);
  }

  @Get(':key/options')
  options(@Param('key') key: string, @Query() q: any) {
    return this.svc.options(key, q);
  }

  @Get(':key/:id')
  get(@Param('key') key: string, @Param('id') id: string) {
    return this.svc.get(key, Number(id));
  }

  @Post(':key')
  @Roles('ADMIN', 'PATHOLOGIST')
  create(@Param('key') key: string, @Body() body: any, @CurrentUser() u: SessionUser) {
    return this.svc.create(key, body, u);
  }

  @Put(':key/:id')
  @Roles('ADMIN', 'PATHOLOGIST')
  update(@Param('key') key: string, @Param('id') id: string, @Body() body: any, @CurrentUser() u: SessionUser) {
    return this.svc.update(key, Number(id), body, u);
  }

  @Delete(':key/:id')
  @Roles('ADMIN')
  remove(@Param('key') key: string, @Param('id') id: string, @CurrentUser() u: SessionUser) {
    return this.svc.remove(key, Number(id), u);
  }
}
