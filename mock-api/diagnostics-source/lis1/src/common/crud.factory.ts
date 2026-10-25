import {
  BadRequestException, Body, Controller, Delete, Get, Inject, NotFoundException, Param,
  ParseIntPipe, Post, Put, Query, Type,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FindOptionsWhere, Like, Repository } from 'typeorm';
import { Roles } from './auth';

export interface CrudOptions {
  searchFields?: string[];
  writeRoles?: string[];
  orderBy?: Record<string, 'ASC' | 'DESC'>;
}

const RESERVED = ['q', 'take', 'skip', 'activeOnly'];

/**
 * Builds a full REST controller (list/filter/search, get, create, update, delete) for a master entity.
 * Every master table in the LIS is served through this so behaviour is uniform.
 */
export function createCrudController<T extends { id: number }>(path: string, entity: Type<T>, opts: CrudOptions = {}) {
  const search = opts.searchFields ?? ['code', 'name'];
  const writeRoles = opts.writeRoles ?? ['ADMIN'];

  @Controller(path)
  class CrudController {
    constructor(@Inject(getRepositoryToken(entity)) public repo: Repository<T>) {}

    columns() {
      return this.repo.metadata.columns.map((c) => c.propertyName);
    }

    clean(body: any) {
      const cols = this.columns();
      const out: any = {};
      for (const [k, v] of Object.entries(body || {})) {
        if (['id', 'createdAt', 'updatedAt'].includes(k) || !cols.includes(k)) continue;
        out[k] = v === '' ? null : v;
      }
      return out;
    }

    @Get()
    async list(@Query() query: Record<string, string>) {
      const cols = this.columns();
      const base: any = {};
      for (const [k, v] of Object.entries(query)) {
        if (RESERVED.includes(k) || !cols.includes(k) || v === '' || v === undefined) continue;
        base[k] = v === 'true' ? true : v === 'false' ? false : v;
      }
      if (query.activeOnly === 'true' && cols.includes('active')) base.active = true;
      let where: FindOptionsWhere<T>[] | FindOptionsWhere<T> = base;
      if (query.q) {
        where = search.filter((f) => cols.includes(f)).map((f) => ({ ...base, [f]: Like(`%${query.q}%`) }));
      }
      return this.repo.find({
        where,
        order: (opts.orderBy ?? { id: 'ASC' }) as any,
        take: Math.min(Number(query.take) || 1000, 5000),
        skip: Number(query.skip) || 0,
      });
    }

    @Get(':id')
    async get(@Param('id', ParseIntPipe) id: number) {
      const row = await this.repo.findOne({ where: { id } as any });
      if (!row) throw new NotFoundException(`${entity.name} ${id} not found`);
      return row;
    }

    @Post()
    @Roles(...writeRoles)
    async create(@Body() body: any) {
      try {
        return await this.repo.save(this.repo.create(this.clean(body)) as any);
      } catch (e: any) {
        throw new BadRequestException(friendly(e));
      }
    }

    @Put(':id')
    @Roles(...writeRoles)
    async update(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
      await this.get(id);
      try {
        await this.repo.update(id, this.clean(body));
      } catch (e: any) {
        throw new BadRequestException(friendly(e));
      }
      return this.get(id);
    }

    @Delete(':id')
    @Roles(...writeRoles)
    async remove(@Param('id', ParseIntPipe) id: number) {
      await this.get(id);
      try {
        await this.repo.delete(id);
      } catch (e: any) {
        throw new BadRequestException(`Cannot delete: record is in use. Deactivate it instead. (${friendly(e)})`);
      }
      return { deleted: true };
    }
  }
  Object.defineProperty(CrudController, 'name', { value: `${entity.name}CrudController` });
  return CrudController;
}

export function friendly(e: any): string {
  const msg: string = e?.message || String(e);
  if (msg.includes('UNIQUE')) return 'A record with this code already exists.';
  if (msg.includes('NOT NULL')) return `A required field is missing (${msg.split('.').pop()}).`;
  return msg;
}
