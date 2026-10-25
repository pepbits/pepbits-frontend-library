// Adapted from healthcare-suite/backend/src/patients/patients.service.ts. Reproduce with ../reference-healthcare-suite-import.mjs.
import '../runtime.mjs';
import { CsvStore } from '../common/csv-store.service.mjs';
import { ValidationFailed } from '../common/errors.mjs';
import { ageFrom, nowIso, paginate, todayIso } from '../common/query.mjs';
const PATIENT_FIELDS = [
    'firstName',
    'lastName',
    'gender',
    'dob',
    'phone',
    'email',
    'nationalId',
    'nationality',
    'address',
    'allergies',
    'status'
];
const POLICY_FIELDS = [
    'payerId',
    'tpaId',
    'planId',
    'networkId',
    'memberId',
    'policyNo',
    'validFrom',
    'validTo',
    'relation',
    'isPrimary',
    'status'
];
export class PatientsService {
    store;
    constructor(store){
        this.store = store;
    }
    expandPolicy(p) {
        const payer = this.store.find('payers', p.payerId);
        const tpa = this.store.find('tpas', p.tpaId);
        const plan = this.store.find('insurance_plans', p.planId);
        const net = this.store.find('networks', p.networkId);
        const t = todayIso();
        return {
            ...p,
            payerName: payer?.name ?? '',
            tpaName: tpa?.name ?? '',
            planName: plan?.name ?? '',
            networkName: net?.name ?? '',
            copayPct: net?.copayPct ?? 0,
            deductible: net?.deductible ?? 0,
            maxCopayPerVisit: net?.maxCopayPerVisit ?? 0,
            isExpired: p.validTo < t,
            isCurrent: p.status === 'Active' && p.validFrom <= t && p.validTo >= t
        };
    }
    summary(p) {
        const policies = this.store.all('patient_policies').filter((x)=>x.patientId === p.id && x.status === 'Active').map((x)=>this.expandPolicy(x));
        const primary = policies.find((x)=>x.isPrimary) ?? policies[0];
        const visits = this.store.all('encounters').filter((e)=>e.patientId === p.id).sort((a, b)=>b.createdAt.localeCompare(a.createdAt));
        return {
            ...p,
            fullName: `${p.firstName} ${p.lastName}`.trim(),
            age: ageFrom(p.dob),
            primaryPolicy: primary ?? null,
            insuranceLabel: primary ? `${primary.payerName} · ${primary.planName}` : 'Self-pay',
            lastVisit: visits[0]?.createdAt ?? ''
        };
    }
    search(q) {
        const rows = this.store.all('patients').map((p)=>({
                ...p,
                fullName: `${p.firstName} ${p.lastName}`
            }));
        const page = paginate(rows, {
            sort: 'mrn',
            dir: 'desc',
            ...q
        }, [
            'mrn',
            'fullName',
            'phone',
            'nationalId',
            'email'
        ]);
        return {
            ...page,
            data: page.data.map((p)=>this.summary(p))
        };
    }
    get(id) {
        const p = this.store.get('patients', id, 'Patient');
        const policies = this.store.all('patient_policies').filter((x)=>x.patientId === id).map((x)=>this.expandPolicy(x));
        const t = todayIso();
        const appointments = this.store.all('appointments').filter((a)=>a.patientId === id).sort((a, b)=>(b.date + b.startTime).localeCompare(a.date + a.startTime)).map((a)=>({
                ...a,
                resourceName: this.store.find('resources', a.resourceId)?.name ?? ''
            }));
        const encounters = this.store.all('encounters').filter((e)=>e.patientId === id).sort((a, b)=>b.createdAt.localeCompare(a.createdAt)).map((e)=>({
                ...e,
                providerName: this.store.find('providers', e.providerId)?.name ?? '',
                departmentName: this.store.find('departments', e.departmentId)?.name ?? ''
            }));
        return {
            ...this.summary(p),
            policies,
            upcomingAppointments: appointments.filter((a)=>a.date >= t && ![
                    'Cancelled',
                    'No-show',
                    'Completed'
                ].includes(a.status)),
            appointments: appointments.slice(0, 20),
            encounters: encounters.slice(0, 20)
        };
    }
    create(body) {
        const patient = this.pick(body, PATIENT_FIELDS);
        const policies = Array.isArray(body.policies) ? body.policies : [];
        this.validate(patient, policies);
        const row = this.store.insert('patients', {
            ...patient,
            id: this.store.nextKey('patients', 'id', 'PT', 5),
            mrn: this.store.nextKey('patients', 'mrn', 'MRN', 6),
            status: patient.status || 'Active',
            createdAt: nowIso()
        });
        this.savePolicies(row.id, policies);
        return this.get(row.id);
    }
    update(id, body) {
        const existing = this.store.get('patients', id, 'Patient');
        const patient = {
            ...existing,
            ...this.pick(body, PATIENT_FIELDS)
        };
        const policies = Array.isArray(body.policies) ? body.policies : undefined;
        this.validate(patient, policies ?? [], id);
        this.store.update('patients', id, patient);
        if (policies) this.savePolicies(id, policies);
        return this.get(id);
    }
    savePolicies(patientId, policies) {
        const keep = new Set();
        const hasPrimary = policies.some((p)=>p.isPrimary && p.status !== 'Inactive');
        policies.forEach((raw, i)=>{
            const p = this.pick(raw, POLICY_FIELDS);
            if (!hasPrimary && i === 0) p.isPrimary = true;
            p.status = p.status || 'Active';
            if (raw.id && this.store.find('patient_policies', raw.id)) {
                this.store.update('patient_policies', raw.id, p);
                keep.add(raw.id);
            } else {
                const r = this.store.insert('patient_policies', {
                    ...p,
                    id: this.store.nextKey('patient_policies', 'id', 'POL', 5),
                    patientId
                });
                keep.add(r.id);
            }
        });
        for (const p of this.store.all('patient_policies').filter((x)=>x.patientId === patientId && !keep.has(x.id))){
            this.store.update('patient_policies', p.id, {
                status: 'Inactive',
                isPrimary: false
            });
        }
    }
    validate(p, policies, selfId) {
        const e = {};
        for (const f of [
            'firstName',
            'lastName',
            'gender',
            'phone'
        ])if (!String(p[f] ?? '').trim()) e[f] = 'This field is required';
        if (p.dob && p.dob > todayIso()) e.dob = 'Date of birth cannot be in the future';
        if (p.phone && !/^[+\d][\d\s-]{6,}$/.test(p.phone)) e.phone = 'Enter a valid phone number';
        if (p.email && !/^\S+@\S+\.\S+$/.test(p.email)) e.email = 'Enter a valid email address';
        if (p.nationalId) {
            const clash = this.store.all('patients').find((x)=>x.id !== selfId && x.nationalId === p.nationalId);
            if (clash) e.nationalId = `Already registered to ${clash.firstName} ${clash.lastName} (${clash.mrn})`;
        }
        policies.forEach((pol, i)=>{
            if (pol.status === 'Inactive') return;
            const k = (f)=>`policies.${i}.${f}`;
            for (const f of [
                'payerId',
                'planId',
                'networkId',
                'memberId',
                'validFrom',
                'validTo'
            ])if (!pol[f]) e[k(f)] = 'Required';
            const plan = pol.planId ? this.store.find('insurance_plans', pol.planId) : undefined;
            if (plan && plan.payerId !== pol.payerId) e[k('planId')] = 'Plan does not belong to the selected payer';
            const net = pol.networkId ? this.store.find('networks', pol.networkId) : undefined;
            if (net && net.planId !== pol.planId) e[k('networkId')] = 'Network does not belong to the selected plan';
            if (pol.validFrom && pol.validTo && pol.validFrom > pol.validTo) e[k('validTo')] = 'Must be after the start date';
        });
        if (Object.keys(e).length) throw new ValidationFailed(e);
    }
    pick(src, fields) {
        const o = {};
        for (const f of fields)if (src?.[f] !== undefined) o[f] = typeof src[f] === 'string' ? src[f].trim() : src[f];
        return o;
    }
}
