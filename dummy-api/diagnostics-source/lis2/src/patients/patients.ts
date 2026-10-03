import { Body, Controller, Get, Injectable, Param, Post, Put, Query } from '@nestjs/common';
import { Db } from '../db/database.service';
import { CurrentUser, SessionUser } from '../common/auth';
import { bad, must, paging } from '../common/util';

export interface PatientInput {
  first_name: string; last_name?: string; dob?: string; gender?: string; ethnicity_id?: number | null; pregnant?: number;
  phone?: string; email?: string; address?: string; national_id?: string;
}

@Injectable()
export class PatientsService {
  constructor(private readonly db: Db) {}

  list(q: any) {
    const { page, pageSize, offset } = paging(q);
    const params: any[] = [];
    let where = '';
    if (q.q) {
      where = `WHERE p.mrn LIKE ? OR p.first_name || ' ' || IFNULL(p.last_name,'') LIKE ? OR p.phone LIKE ? OR p.national_id LIKE ?
        OR p.id IN (SELECT patient_id FROM patient_identifiers WHERE identifier LIKE ?)`;
      const like = `%${q.q}%`;
      params.push(like, like, like, like, like);
    }
    const total = this.db.get(`SELECT COUNT(*) c FROM patients p ${where}`, ...params).c;
    const data = this.db.all(
      `SELECT p.*, e.name ethnicity, f.name source_facility,
        (SELECT COUNT(*) FROM orders o WHERE o.patient_id = p.id) order_count
       FROM patients p LEFT JOIN m_ethnicities e ON e.id = p.ethnicity_id LEFT JOIN m_facilities f ON f.id = p.source_facility_id
       ${where} ORDER BY p.id DESC LIMIT ? OFFSET ?`, ...params, pageSize, offset);
    return { data, total, page, pageSize };
  }

  get(id: number) {
    const p = must(this.db.get(`SELECT p.*, e.name ethnicity FROM patients p LEFT JOIN m_ethnicities e ON e.id = p.ethnicity_id WHERE p.id = ?`, id), 'Patient');
    p.identifiers = this.db.all(`SELECT i.*, f.name facility FROM patient_identifiers i LEFT JOIN m_facilities f ON f.id = i.facility_id WHERE patient_id = ?`, id);
    p.encounters = this.db.all(`SELECT e.*, l.name location, d.name doctor, f.name facility FROM encounters e LEFT JOIN m_locations l ON l.id = e.location_id
      LEFT JOIN m_doctors d ON d.id = e.doctor_id LEFT JOIN m_facilities f ON f.id = e.facility_id WHERE patient_id = ? ORDER BY e.id DESC`, id);
    p.orders = this.db.all(`SELECT o.*, (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) item_count,
      (SELECT GROUP_CONCAT(t.code, ', ') FROM order_items oi JOIN m_tests t ON t.id = oi.test_id WHERE oi.order_id = o.id) tests
      FROM orders o WHERE patient_id = ? ORDER BY o.id DESC`, id);
    return p;
  }

  private validate(b: PatientInput) {
    if (!b.first_name?.trim()) bad('First name is required');
    if (b.gender && !['M', 'F', 'O', 'U'].includes(b.gender)) bad('Gender must be M, F, O or U');
    if (b.dob && Number.isNaN(Date.parse(b.dob))) bad('Date of birth is invalid');
  }

  create(b: PatientInput, userId: number | null, facilityId?: number | null) {
    this.validate(b);
    const mrn = this.db.nextNo('MRN', 7);
    const id = this.db.insert('patients', {
      mrn, first_name: b.first_name.trim(), last_name: b.last_name?.trim(), dob: b.dob, gender: b.gender || 'U', ethnicity_id: b.ethnicity_id || null,
      pregnant: b.pregnant ? 1 : 0, phone: b.phone, email: b.email, address: b.address, national_id: b.national_id, source_facility_id: facilityId ?? null,
    });
    this.db.audit(userId, 'CREATE', 'patients', id, { mrn });
    return id;
  }

  update(id: number, b: PatientInput, userId: number) {
    this.validate(b);
    this.db.update('patients', id, {
      first_name: b.first_name, last_name: b.last_name, dob: b.dob, gender: b.gender, ethnicity_id: b.ethnicity_id || null, pregnant: b.pregnant ? 1 : 0,
      phone: b.phone, email: b.email, address: b.address, national_id: b.national_id, updated_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    });
    this.db.audit(userId, 'UPDATE', 'patients', id);
  }

  /**
   * Patient matching for inbound orders (EMPI-lite):
   * 1) facility identifier  2) national id  3) name + DOB + gender. Otherwise a new patient is registered.
   */
  matchOrCreate(facilityId: number | null, externalId: string | null, b: PatientInput): { id: number; matched: string } {
    let pid: number | undefined;
    let matched = 'CREATED';
    if (externalId) {
      pid = this.db.get('SELECT patient_id FROM patient_identifiers WHERE facility_id IS ? AND identifier = ?', facilityId, externalId)?.patient_id;
      if (pid) matched = 'FACILITY_ID';
    }
    if (!pid && b.national_id) {
      pid = this.db.get('SELECT id FROM patients WHERE national_id = ?', b.national_id)?.id;
      if (pid) matched = 'NATIONAL_ID';
    }
    if (!pid && b.dob && b.last_name) {
      pid = this.db.get(`SELECT id FROM patients WHERE lower(first_name) = lower(?) AND lower(last_name) = lower(?) AND dob = ? AND gender = ?`,
        b.first_name, b.last_name, b.dob, b.gender || 'U')?.id;
      if (pid) matched = 'DEMOGRAPHICS';
    }
    if (!pid) pid = this.create(b, null, facilityId);
    if (externalId) {
      this.db.run('INSERT OR IGNORE INTO patient_identifiers(patient_id, facility_id, identifier) VALUES (?,?,?)', pid, facilityId, externalId);
    }
    return { id: pid, matched };
  }
}

@Controller('patients')
export class PatientsController {
  constructor(private readonly svc: PatientsService, private readonly db: Db) {}

  @Get()
  list(@Query() q: any) {
    return this.svc.list(q);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.svc.get(Number(id));
  }

  @Post()
  create(@Body() b: PatientInput, @CurrentUser() u: SessionUser) {
    return this.svc.get(this.svc.create(b, u.id));
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() b: PatientInput, @CurrentUser() u: SessionUser) {
    this.svc.update(Number(id), b, u.id);
    return this.svc.get(Number(id));
  }

  /** Cumulative results for a patient: parameter × time. */
  @Get(':id/cumulative')
  cumulative(@Param('id') id: string) {
    return this.db.all(`SELECT r.parameter_id, p.code, p.name, r.value, r.flag, r.unit, i.signed_at, i.id item_id, t.name test
      FROM results r JOIN order_items i ON i.id = r.order_item_id JOIN orders o ON o.id = i.order_id JOIN m_parameters p ON p.id = r.parameter_id
      JOIN m_tests t ON t.id = i.test_id WHERE o.patient_id = ? AND i.status = 'SIGNED' ORDER BY i.signed_at DESC LIMIT 1000`, Number(id));
  }
}
