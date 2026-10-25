import * as M from './masters.entities';
import * as W from './workflow.entities';

export * from './masters.entities';
export * from './workflow.entities';

const isEntity = (v: any) => typeof v === 'function' && !['Base', 'MasterBase'].includes(v.name);
export const ALL_ENTITIES = [...Object.values(M), ...Object.values(W)].filter(isEntity) as Function[];
