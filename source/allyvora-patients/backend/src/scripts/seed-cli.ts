import { migrate, resetDatabase } from '../db';
import { seedDemoPatients, seedReferenceData } from '../seed';

const reset = process.argv.includes('--reset');
if (reset) {
  resetDatabase();
  console.log('Database reset');
} else {
  migrate();
}
seedReferenceData();
const n = seedDemoPatients();
console.log(n ? `Seeded ${n} demo patients` : 'Patients already present, nothing to seed');
