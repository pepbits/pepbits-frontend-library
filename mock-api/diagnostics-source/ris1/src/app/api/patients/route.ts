import { all, get, insert } from '@/lib/db';
import { handle, ok, need } from '@/lib/http';
import { currentUser } from '@/lib/session';
import { newMrn } from '@/lib/ids';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  return handle(() => {
    const q = new URL(req.url).searchParams.get('q')?.trim();
    const like = `%${q || ''}%`;
    const rows = all(
      `SELECT p.*, (SELECT COUNT(*) FROM orders o WHERE o.patient_id = p.id) AS order_count,
              (SELECT MAX(ordered_at) FROM orders o WHERE o.patient_id = p.id) AS last_visit
       FROM patients p
       WHERE ? = '' OR p.mrn LIKE ? OR p.first_name || ' ' || p.last_name LIKE ? OR p.last_name || ' ' || p.first_name LIKE ? OR p.phone LIKE ?
       ORDER BY COALESCE(last_visit, p.created_at) DESC LIMIT 200`,
      q || '', like, like, like, like,
    );
    return ok(rows);
  });
}

export function POST(req: Request) {
  return handle(async () => {
    const b = await req.json();
    need(b.first_name?.trim(), 'First name is required');
    need(b.last_name?.trim(), 'Last name is required');
    need(b.dob, 'Date of birth is required');
    need(['M', 'F', 'O', 'U'].includes(b.sex), 'Choose a sex');
    if (b.phone) {
      const dup = get('SELECT mrn FROM patients WHERE lower(first_name) = lower(?) AND lower(last_name) = lower(?) AND dob = ?', b.first_name, b.last_name, b.dob);
      need(!dup || b.force, `A patient with the same name and date of birth exists (${dup?.mrn}). Check before creating a duplicate.`, 409);
    }
    const id = insert('patients', {
      mrn: b.mrn?.trim() || newMrn(), first_name: b.first_name.trim(), last_name: b.last_name.trim(), dob: b.dob, sex: b.sex,
      phone: b.phone, email: b.email, address: b.address, insurance: b.insurance, allergies: b.allergies,
    });
    audit(currentUser(), 'PATIENT_REGISTERED', 'patient', id);
    return ok(get('SELECT * FROM patients WHERE id = ?', id), 201);
  });
}
