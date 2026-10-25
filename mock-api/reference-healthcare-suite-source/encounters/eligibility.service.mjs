// Adapted from healthcare-suite/backend/src/encounters/eligibility.service.ts. Reproduce with ../reference-healthcare-suite-import.mjs.
import { BadRequestException } from '../runtime.mjs';
import { CsvStore } from '../common/csv-store.service.mjs';
import { localDate, nowIso, todayIso } from '../common/query.mjs';
import { PatientsService } from '../patients/patients.service.mjs';
export class EligibilityService {
    store;
    patients;
    constructor(store, patients){
        this.store = store;
        this.patients = patients;
    }
    check(body) {
        if (!body.policyId) throw new BadRequestException('Choose a policy to check');
        const policy = this.store.get('patient_policies', body.policyId, 'Policy');
        if (body.patientId && policy.patientId !== body.patientId) throw new BadRequestException('This policy belongs to another patient');
        const payer = this.store.get('payers', policy.payerId, 'Payer');
        const t = todayIso();
        let status = 'Eligible';
        let message = 'Member is active. Benefits are available for outpatient services.';
        if (policy.status !== 'Active') {
            status = 'Ineligible';
            message = 'Policy is inactive on the patient record';
        } else if (policy.validTo < t) {
            status = 'Ineligible';
            message = `Policy expired on ${policy.validTo}`;
        } else if (policy.validFrom > t) {
            status = 'Ineligible';
            message = `Policy starts on ${policy.validFrom}`;
        } else if (/9$/.test(policy.memberId)) {
            status = 'Ineligible';
            message = 'Payer reports the member is not active';
        } else if (!payer.eligibilityEnabled) {
            status = 'Manual';
            message = `${payer.name} has no real-time eligibility. Verify by phone or portal and note the reference.`;
        }
        const row = this.store.insert('eligibility_checks', {
            id: this.store.nextKey('eligibility_checks', 'id', 'EL', 6),
            patientId: policy.patientId,
            policyId: policy.id,
            status,
            reference: status === 'Ineligible' ? '' : `ELG-${Date.now().toString(36).toUpperCase()}`,
            message,
            checkedAt: nowIso()
        });
        return {
            ...row,
            policy: this.patients.expandPolicy(policy)
        };
    }
    validRef(policyId, reference) {
        return this.store.all('eligibility_checks').find((c)=>c.policyId === policyId && c.reference === reference && [
                'Eligible',
                'Manual'
            ].includes(c.status) && localDate(c.checkedAt) === todayIso());
    }
}
