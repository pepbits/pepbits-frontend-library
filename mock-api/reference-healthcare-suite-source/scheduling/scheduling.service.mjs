// Adapted from healthcare-suite/backend/src/scheduling/scheduling.service.ts. Reproduce with ../reference-healthcare-suite-import.mjs.
import { BadRequestException } from '../runtime.mjs';
import { CsvStore } from '../common/csv-store.service.mjs';
import { ValidationFailed } from '../common/errors.mjs';
import { nowIso, paginate, todayIso, toHhmm, toMinutes } from '../common/query.mjs';
import { PatientsService } from '../patients/patients.service.mjs';
const DAYS = [
    'Sun',
    'Mon',
    'Tue',
    'Wed',
    'Thu',
    'Fri',
    'Sat'
];
const INACTIVE = [
    'Cancelled'
];
const TRANSITIONS = {
    Booked: [
        'Confirmed',
        'Arrived',
        'Cancelled',
        'No-show'
    ],
    Confirmed: [
        'Arrived',
        'Cancelled',
        'No-show'
    ],
    Arrived: [
        'In Consultation',
        'Completed',
        'Cancelled'
    ],
    'In Consultation': [
        'Completed'
    ],
    'No-show': [
        'Booked'
    ],
    Cancelled: [],
    Completed: []
};
export class SchedulingService {
    store;
    patients;
    constructor(store, patients){
        this.store = store;
        this.patients = patients;
    }
    nowMinutes() {
        const d = new Date();
        return d.getHours() * 60 + d.getMinutes();
    }
    resourceSlots(resource, date, excludeApptId) {
        const dow = DAYS[new Date(`${date}T00:00:00`).getDay()];
        const schedules = this.store.all('resource_schedules').filter((s)=>s.resourceId === resource.id && s.status === 'Active' && s.validFrom <= date && s.validTo >= date && String(s.days).split('|').includes(dow));
        const blocks = this.store.all('resource_blocks').filter((b)=>b.resourceId === resource.id && b.date === date && b.status !== 'Inactive');
        const appts = this.store.all('appointments').filter((a)=>a.resourceId === resource.id && a.date === date && !INACTIVE.includes(a.status) && a.id !== excludeApptId);
        const isToday = date === todayIso();
        const past = date < todayIso();
        const now = this.nowMinutes();
        const slots = [];
        for (const s of schedules){
            const step = Number(s.slotMinutes) || 15;
            for(let m = toMinutes(s.startTime); m + step <= toMinutes(s.endTime); m += step){
                const start = toHhmm(m);
                const end = toHhmm(m + step);
                if (slots.some((x)=>x.start === start)) continue;
                const block = blocks.find((b)=>toMinutes(b.startTime) < m + step && toMinutes(b.endTime) > m);
                const appt = appts.find((a)=>toMinutes(a.startTime) < m + step && toMinutes(a.endTime) > m);
                let status = 'free';
                if (appt) status = 'booked';
                else if (block) status = 'blocked';
                else if (past || isToday && m < now) status = 'past';
                slots.push({
                    start,
                    end,
                    status,
                    reason: block?.reason ?? '',
                    appointment: appt ? this.decorate(appt) : null
                });
            }
        }
        return slots.sort((a, b)=>a.start.localeCompare(b.start));
    }
    slots(q) {
        const date = q.date || todayIso();
        const ids = q.resourceIds ? q.resourceIds.split(',') : null;
        const resources = this.store.all('resources').filter((r)=>r.status === 'Active' && (!ids || ids.includes(r.id)) && (!q.departmentId || r.departmentId === q.departmentId) && (!q.resourceType || r.resourceType === q.resourceType));
        const out = resources.map((r)=>{
            const slots = this.resourceSlots(r, date);
            return {
                id: r.id,
                name: r.name,
                resourceType: r.resourceType,
                providerId: r.providerId,
                departmentId: r.departmentId,
                departmentName: this.store.find('departments', r.departmentId)?.name ?? '',
                slotMinutes: slots.length > 1 ? toMinutes(slots[0].end) - toMinutes(slots[0].start) : 15,
                free: slots.filter((s)=>s.status === 'free').length,
                booked: slots.filter((s)=>s.status === 'booked').length,
                slots
            };
        });
        const all = out.flatMap((r)=>r.slots);
        return {
            date,
            dayStart: all.length ? all.reduce((m, s)=>s.start < m ? s.start : m, '23:59') : '08:00',
            dayEnd: all.length ? all.reduce((m, s)=>s.end > m ? s.end : m, '00:00') : '18:00',
            resources: out
        };
    }
    decorate(a) {
        const p = a.patientId ? this.store.find('patients', a.patientId) : undefined;
        const r = this.store.find('resources', a.resourceId);
        return {
            ...a,
            patientName: p ? `${p.firstName} ${p.lastName}` : a.guestName,
            mrn: p?.mrn ?? '',
            phone: p?.phone ?? a.guestPhone,
            resourceName: r?.name ?? '',
            providerId: r?.providerId ?? '',
            departmentName: this.store.find('departments', a.departmentId)?.name ?? ''
        };
    }
    list(q) {
        const rows = this.store.all('appointments').map((a)=>this.decorate(a));
        return paginate(rows, {
            sort: 'startTime',
            pageSize: 200,
            ...q
        }, [
            'apptNo',
            'patientName',
            'mrn',
            'phone',
            'resourceName'
        ]);
    }
    get(id) {
        return this.decorate(this.store.get('appointments', id, 'Appointment'));
    }
    assertSlot(resourceId, date, startTime, excludeId) {
        const resource = this.store.get('resources', resourceId, 'Resource');
        if (resource.status !== 'Active') throw new BadRequestException(`${resource.name} is not active`);
        if (date < todayIso()) throw new BadRequestException('Appointments cannot be booked in the past');
        const slot = this.resourceSlots(resource, date, excludeId).find((s)=>s.start === startTime);
        if (!slot) throw new BadRequestException(`${resource.name} has no slot at ${startTime} on ${date}`);
        if (slot.status === 'booked') throw new BadRequestException(`That slot was just booked (${slot.appointment?.apptNo}). Pick another time.`);
        if (slot.status === 'blocked') throw new BadRequestException(`That time is blocked: ${slot.reason}`);
        if (slot.status === 'past') throw new BadRequestException('That slot has already passed');
        return {
            resource,
            slot
        };
    }
    book(body) {
        const e = {};
        if (!body.resourceId) e.resourceId = 'Choose a resource';
        if (!body.date) e.date = 'Choose a date';
        if (!body.startTime) e.startTime = 'Choose a slot';
        if (!body.patientId) {
            if (!body.guestName?.trim()) e.guestName = 'Enter the patient name';
            if (!body.guestPhone?.trim()) e.guestPhone = 'Enter a contact number';
        }
        if (Object.keys(e).length) throw new ValidationFailed(e);
        if (body.patientId) this.store.get('patients', body.patientId, 'Patient');
        const { resource, slot } = this.assertSlot(body.resourceId, body.date, body.startTime);
        if (body.patientId) {
            const clash = this.store.all('appointments').find((a)=>a.patientId === body.patientId && a.date === body.date && !INACTIVE.includes(a.status) && toMinutes(a.startTime) < toMinutes(slot.end) && toMinutes(a.endTime) > toMinutes(slot.start));
            if (clash) throw new BadRequestException(`Patient already has ${clash.apptNo} at ${clash.startTime} on this day`);
        }
        const row = this.store.insert('appointments', {
            id: this.store.nextKey('appointments', 'id', 'AP', 6),
            apptNo: this.store.nextKey('appointments', 'apptNo', 'APT', 6),
            date: body.date,
            startTime: slot.start,
            endTime: slot.end,
            resourceId: resource.id,
            departmentId: resource.departmentId,
            patientId: body.patientId ?? '',
            patientType: body.patientId ? 'Registered' : 'Unregistered',
            guestName: body.patientId ? '' : body.guestName,
            guestPhone: body.patientId ? '' : body.guestPhone,
            guestGender: body.patientId ? '' : body.guestGender ?? '',
            guestDob: body.patientId ? '' : body.guestDob ?? '',
            reason: body.reason ?? '',
            notes: body.notes ?? '',
            status: 'Booked',
            encounterId: '',
            createdAt: nowIso(),
            createdBy: 'U001'
        });
        return this.decorate(row);
    }
    reschedule(id, body) {
        const a = this.store.get('appointments', id, 'Appointment');
        if (![
            'Booked',
            'Confirmed',
            'No-show'
        ].includes(a.status)) throw new BadRequestException(`A ${a.status.toLowerCase()} appointment cannot be rescheduled`);
        const { resource, slot } = this.assertSlot(body.resourceId ?? a.resourceId, body.date ?? a.date, body.startTime, id);
        return this.decorate(this.store.update('appointments', id, {
            date: body.date ?? a.date,
            startTime: slot.start,
            endTime: slot.end,
            resourceId: resource.id,
            departmentId: resource.departmentId,
            status: 'Booked'
        }));
    }
    setStatus(id, status, reason) {
        const a = this.store.get('appointments', id, 'Appointment');
        if (!(TRANSITIONS[a.status] ?? []).includes(status)) throw new BadRequestException(`Cannot move an appointment from ${a.status} to ${status}`);
        return this.decorate(this.store.update('appointments', id, {
            status,
            notes: reason ? `${a.notes ? a.notes + ' | ' : ''}${status}: ${reason}` : a.notes
        }));
    }
    register(id, body) {
        const a = this.store.get('appointments', id, 'Appointment');
        if (a.patientId) return {
            appointment: this.decorate(a),
            patient: this.patients.get(a.patientId)
        };
        const [first, ...rest] = String(a.guestName).split(' ');
        const patient = this.patients.create({
            firstName: body.firstName ?? first,
            lastName: body.lastName ?? (rest.join(' ') || '-'),
            gender: body.gender ?? a.guestGender,
            dob: body.dob ?? a.guestDob,
            phone: body.phone ?? a.guestPhone,
            ...body
        });
        const appt = this.store.update('appointments', id, {
            patientId: patient.id,
            patientType: 'Registered'
        });
        return {
            appointment: this.decorate(appt),
            patient
        };
    }
}
