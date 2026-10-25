import { migrate } from './db';
import { resetAndSeed } from './seed';

migrate();
resetAndSeed();
console.log('Database reset with synthetic tenant configuration.');
