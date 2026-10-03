import { all } from '@/lib/db';
import { handle, ok } from '@/lib/http';

export const dynamic = 'force-dynamic';

/** Small reference lists the UI needs everywhere. */
export function GET() {
  return handle(() => ok({
    modalities: all('SELECT * FROM modalities WHERE active = 1 ORDER BY code'),
    procedures: all('SELECT * FROM procedures WHERE active = 1 ORDER BY modality_code, name'),
    referrers: all('SELECT * FROM referrers WHERE active = 1 ORDER BY name'),
    radiologists: all("SELECT id, name, title, role FROM users WHERE active = 1 AND role IN ('RADIOLOGIST','RESIDENT') ORDER BY name"),
    technologists: all("SELECT id, name, title, modalities FROM users WHERE active = 1 AND role = 'TECHNOLOGIST' ORDER BY name"),
    templates: all('SELECT * FROM templates WHERE active = 1 ORDER BY kind DESC, name'),
    interfaces: all('SELECT * FROM interfaces ORDER BY direction, name'),
  }));
}
