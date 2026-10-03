import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Counter } from '../entities';

/** Gap-free, human-readable document numbers, e.g. ORD2609300001. Resets daily per prefix. */
@Injectable()
export class SequenceService {
  constructor(private ds: DataSource) {}

  async next(prefix: string, daily = true, pad = 4): Promise<string> {
    const d = new Date();
    const day = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const key = daily ? `${prefix}-${day}` : prefix;
    return this.ds.transaction(async (m) => {
      let c = await m.findOne(Counter, { where: { name: key } });
      if (!c) c = m.create(Counter, { name: key, value: 0 });
      c.value += 1;
      await m.save(c);
      return daily ? `${prefix}${day}${String(c.value).padStart(pad, '0')}` : `${prefix}${String(c.value).padStart(pad, '0')}`;
    });
  }
}
