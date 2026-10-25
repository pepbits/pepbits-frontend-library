// Adapted from healthcare-suite/backend/src/encounters/encounters.service.ts. Reproduce with ../reference-healthcare-suite-import.mjs.
import { BadRequestException } from '../runtime.mjs';
import { CsvStore } from '../common/csv-store.service.mjs';
import { ValidationFailed } from '../common/errors.mjs';
import { localDate, nowIso, paginate, round2, todayIso } from '../common/query.mjs';
import { ApprovalsService } from '../orders/approvals.service.mjs';
import { OrdersService } from '../orders/orders.service.mjs';
import { PatientsService } from '../patients/patients.service.mjs';
import { PricingService } from '../pricing/pricing.service.mjs';
import { EligibilityService } from './eligibility.service.mjs';
export class EncountersService {
    store;
    patients;
    orders;
    approvals;
    pricing;
    eligibility;
    constructor(store, patients, orders, approvals, pricing, eligibility){
        this.store = store;
        this.patients = patients;
        this.orders = orders;
        this.approvals = approvals;
        this.pricing = pricing;
        this.eligibility = eligibility;
    }
    decorate(e) {
        const p = this.store.find('patients', e.patientId);
        const pol = e.policyId ? this.store.find('patient_policies', e.policyId) : undefined;
        const lines = this.store.all('orders').filter((o)=>o.encounterId === e.id && o.status !== 'Cancelled');
        return {
            ...e,
            patientName: p ? `${p.firstName} ${p.lastName}` : '',
            mrn: p?.mrn ?? '',
            gender: p?.gender ?? '',
            dob: p?.dob ?? '',
            providerName: this.store.find('providers', e.providerId)?.name ?? '',
            departmentName: this.store.find('departments', e.departmentId)?.name ?? '',
            payerName: pol ? this.store.find('payers', pol.payerId)?.name ?? '' : 'Self-pay',
            lineCount: lines.length,
            unbilled: lines.filter((o)=>o.status === 'Signed').length,
            pendingApprovals: lines.filter((o)=>o.priorAuthStatus === 'Pending' || o.erxStatus === 'Pending').length
        };
    }
    list(q) {
        this.approvals.settle();
        const { date, ...rest } = q;
        const rows = this.store.all('encounters').filter((e)=>!date || localDate(e.createdAt) === date).map((e)=>this.decorate(e));
        return paginate(rows, {
            sort: 'createdAt',
            dir: 'desc',
            ...rest
        }, [
            'encNo',
            'patientName',
            'mrn',
            'providerName',
            'departmentName',
            'payerName'
        ]);
    }
    get(id) {
        this.approvals.settle();
        const e = this.store.get('encounters', id, 'Encounter');
        const coverage = e.paymentClass === 'Insurance' ? this.pricing.coverage(e.policyId) : null;
        const lines = this.orders.forEncounter(id);
        const sum = (f, cat)=>round2(lines.filter((l)=>!cat || l.billingCategory === cat).reduce((s, l)=>s + Number(l[f] || 0), 0));
        return {
            ...this.decorate(e),
            patient: this.patients.summary(this.store.get('patients', e.patientId, 'Patient')),
            policy: e.policyId ? this.patients.expandPolicy(this.store.get('patient_policies', e.policyId)) : null,
            coverage: coverage ? {
                payerName: coverage.payer.name,
                tpaName: coverage.tpa?.name ?? '',
                planName: coverage.plan.name,
                networkName: coverage.network.name,
                priceListName: coverage.priceList?.name ?? '',
                copayPct: coverage.copayPct,
                deductible: coverage.deductible,
                maxCopayPerVisit: coverage.maxCopayPerVisit,
                priorAuthLimit: coverage.priorAuthLimit,
                active: coverage.active
            } : null,
            appointment: e.appointmentId ? this.store.find('appointments', e.appointmentId) ?? null : null,
            orders: lines,
            approvals: this.approvals.forEncounter(id),
            invoices: this.store.all('invoices').filter((i)=>i.encounterId === id).map(({ lines: _l, payments: _p, ...rest })=>rest),
            totals: {
                net: sum('net'),
                patientShare: sum('patientShare'),
                payerShare: sum('payerShare'),
                hospital: sum('net', 'Hospital'),
                pharmacy: sum('net', 'Pharmacy')
            }
        };
    }
    create(body) {
        const e = {};
        if (!body.patientId) e.patientId = 'Find and select a patient first';
        if (!body.encounterType) e.encounterType = 'Choose the encounter type';
        const pharmacyOnly = body.encounterType === 'Pharmacy';
        if (!pharmacyOnly && !body.departmentId) e.departmentId = 'Choose a department';
        if (!pharmacyOnly && !body.providerId) e.providerId = 'Choose the treating provider';
        if (![
            'Cash',
            'Insurance'
        ].includes(body.paymentClass)) e.paymentClass = 'Choose cash or insurance';
        if (body.paymentClass === 'Insurance' && !body.policyId) e.policyId = 'Choose the policy to bill';
        if (Object.keys(e).length) throw new ValidationFailed(e);
        const patient = this.store.get('patients', body.patientId, 'Patient');
        if (patient.status !== 'Active') throw new BadRequestException(`${patient.firstName} ${patient.lastName} is inactive`);
        if (body.providerId) {
            const prov = this.store.get('providers', body.providerId, 'Provider');
            if (prov.status !== 'Active') throw new BadRequestException(`${prov.name} is inactive`);
        }
        let eligibilityStatus = 'Not required';
        let eligibilityMessage = '';
        let eligibilityCheckedAt = '';
        if (body.paymentClass === 'Insurance') {
            const pol = this.store.get('patient_policies', body.policyId, 'Policy');
            if (pol.patientId !== patient.id) throw new BadRequestException('The policy belongs to another patient');
            const check = body.eligibilityRef ? this.eligibility.validRef(body.policyId, body.eligibilityRef) : undefined;
            if (!check) throw new ValidationFailed({
                eligibility: 'Check eligibility today before creating an insured encounter, or switch to cash'
            });
            eligibilityStatus = check.status;
            eligibilityMessage = check.message;
            eligibilityCheckedAt = check.checkedAt;
        }
        let appt;
        if (body.appointmentId) {
            appt = this.store.get('appointments', body.appointmentId, 'Appointment');
            if (appt.patientId !== patient.id) throw new BadRequestException(`${appt.apptNo} is booked for a different patient`);
            if (appt.encounterId) throw new BadRequestException(`${appt.apptNo} already has encounter ${this.store.find('encounters', appt.encounterId)?.encNo}`);
            if ([
                'Cancelled',
                'No-show',
                'Completed'
            ].includes(appt.status)) throw new BadRequestException(`${appt.apptNo} is ${appt.status.toLowerCase()}`);
        }
        const today = todayIso();
        const open = this.store.all('encounters').find((x)=>x.patientId === patient.id && x.providerId === (body.providerId ?? '') && x.encounterType === body.encounterType && localDate(x.createdAt) === today && ![
                'Completed',
                'Cancelled'
            ].includes(x.status));
        if (open) throw new BadRequestException(`Patient already has an open ${body.encounterType.toLowerCase()} encounter today (${open.encNo}). Continue that one instead.`);
        const enc = this.store.insert('encounters', {
            id: this.store.nextKey('encounters', 'id', 'EN', 6),
            encNo: this.store.nextKey('encounters', 'encNo', 'ENC', 6),
            patientId: patient.id,
            appointmentId: appt?.id ?? '',
            encounterType: body.encounterType,
            visitType: body.visitType || 'New',
            departmentId: body.departmentId ?? (pharmacyOnly ? 'D008' : ''),
            specialtyId: body.specialtyId ?? '',
            providerId: body.providerId ?? '',
            paymentClass: body.paymentClass,
            policyId: body.paymentClass === 'Insurance' ? body.policyId : '',
            eligibilityStatus,
            eligibilityRef: body.paymentClass === 'Insurance' ? body.eligibilityRef : '',
            eligibilityMessage,
            eligibilityCheckedAt,
            chiefComplaint: body.chiefComplaint ?? '',
            status: 'Registered',
            facilityId: body.facilityId || 'F001',
            createdAt: nowIso(),
            createdBy: 'U001'
        });
        if (appt) this.store.update('appointments', appt.id, {
            encounterId: enc.id,
            status: 'Arrived'
        });
        const prov = body.providerId ? this.store.find('providers', body.providerId) : undefined;
        if (!pharmacyOnly && prov?.consultationServiceCode) {
            const code = body.visitType === 'Follow-up' && prov.providerType === 'Doctor' ? 'SRV-CON-FU' : prov.consultationServiceCode;
            this.orders.createLine(enc, {
                code,
                qty: 1
            }, 'Signed');
        }
        return this.get(enc.id);
    }
    setStatus(id, status) {
        const e = this.store.get('encounters', id, 'Encounter');
        const allowed = {
            Registered: [
                'In Consultation',
                'Cancelled',
                'Completed'
            ],
            'In Consultation': [
                'Completed',
                'Cancelled'
            ],
            Completed: [
                'In Consultation'
            ],
            Cancelled: []
        };
        if (!(allowed[e.status] ?? []).includes(status)) throw new BadRequestException(`Cannot move an encounter from ${e.status} to ${status}`);
        const lines = this.orders.forEncounter(id);
        if (status === 'Cancelled') {
            if (lines.some((l)=>l.status === 'Billed')) throw new BadRequestException('This encounter has billed lines. Cancel its invoices first.');
            lines.forEach((l)=>this.store.update('orders', l.id, {
                    status: 'Cancelled'
                }));
        }
        if (status === 'Completed' && lines.some((l)=>l.status === 'Draft')) throw new BadRequestException('Sign or remove draft orders before completing the encounter');
        const updated = this.store.update('encounters', id, {
            status
        });
        if (e.appointmentId && [
            'Completed',
            'In Consultation'
        ].includes(status)) {
            const a = this.store.find('appointments', e.appointmentId);
            if (a && a.status !== 'Cancelled') this.store.update('appointments', a.id, {
                status
            });
        }
        return this.decorate(updated);
    }
}
