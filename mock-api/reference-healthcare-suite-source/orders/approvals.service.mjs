// Adapted from healthcare-suite/backend/src/orders/approvals.service.ts. Reproduce with ../reference-healthcare-suite-import.mjs.
import { BadRequestException } from '../runtime.mjs';
import { CsvStore } from '../common/csv-store.service.mjs';
import { ValidationFailed } from '../common/errors.mjs';
import { nowIso, paginate, round2 } from '../common/query.mjs';
const DELAY = Number(process.env.APPROVAL_DELAY_MS ?? 8000);
const PA_LIMIT = 5000;
const ERX_LIMIT = 10000;
export class ApprovalsService {
    store;
    constructor(store){
        this.store = store;
    }
    submit(encounterId, body) {
        const enc = this.store.get('encounters', encounterId, 'Encounter');
        const channel = body.channel === 'eRx' ? 'eRx' : 'PriorAuth';
        const e = {};
        if (!String(body.diagnosis ?? '').trim()) e.diagnosis = 'Enter the diagnosis (ICD-10) for this request';
        if (!Array.isArray(body.orderIds) || !body.orderIds.length) e.orderIds = 'Select at least one line';
        if (channel === 'PriorAuth' && !String(body.justification ?? '').trim()) e.justification = 'Add a clinical justification for the payer';
        if (Object.keys(e).length) throw new ValidationFailed(e);
        if (channel === 'PriorAuth' && enc.paymentClass !== 'Insurance') throw new BadRequestException('Prior approval applies to insured encounters only');
        const lines = body.orderIds.map((id)=>this.store.get('orders', id, 'Order line'));
        for (const l of lines){
            if (l.encounterId !== encounterId) throw new BadRequestException(`${l.name} belongs to another encounter`);
            if (l.status === 'Cancelled' || l.status === 'Billed') throw new BadRequestException(`${l.name} is ${l.status.toLowerCase()}`);
            if (channel === 'PriorAuth' && (!l.priorAuthRequired || l.erxRequired)) throw new BadRequestException(`${l.name} does not need a separate prior approval`);
            if (channel === 'PriorAuth' && ![
                'Required',
                'Rejected'
            ].includes(l.priorAuthStatus)) throw new BadRequestException(`${l.name} is already ${l.priorAuthStatus.toLowerCase()}`);
            if (channel === 'eRx' && !l.erxRequired) throw new BadRequestException(`${l.name} is not a prescription medicine`);
            if (channel === 'eRx' && ![
                'Required',
                'Rejected'
            ].includes(l.erxStatus)) throw new BadRequestException(`eRx for ${l.name} is already ${l.erxStatus.toLowerCase()}`);
        }
        const policy = enc.policyId ? this.store.find('patient_policies', enc.policyId) : undefined;
        const row = this.store.insert('approvals', {
            id: this.store.nextKey('approvals', 'id', 'AR', 6),
            approvalNo: this.store.nextKey('approvals', 'approvalNo', channel === 'eRx' ? 'ERX' : 'PA', 6),
            channel,
            encounterId,
            patientId: enc.patientId,
            policyId: enc.policyId ?? '',
            payerId: policy?.payerId ?? '',
            orderIds: lines.map((l)=>l.id),
            diagnosis: body.diagnosis,
            justification: body.justification ?? '',
            requestedAmount: round2(lines.reduce((s, l)=>s + (enc.paymentClass === 'Insurance' ? l.payerShare : l.net), 0)),
            approvedAmount: 0,
            status: 'Pending',
            authorizationNo: '',
            remarks: '',
            submittedAt: nowIso(),
            respondedAt: ''
        });
        for (const l of lines){
            if (channel === 'eRx') {
                this.store.update('orders', l.id, {
                    erxStatus: 'Pending',
                    erxId: row.id,
                    ...l.priorAuthRequired ? {
                        priorAuthStatus: 'Pending',
                        approvalId: row.id
                    } : {}
                });
            } else this.store.update('orders', l.id, {
                priorAuthStatus: 'Pending',
                approvalId: row.id
            });
        }
        return this.decorate(row);
    }
    settle() {
        const now = Date.now();
        for (const a of this.store.all('approvals').filter((x)=>x.status === 'Pending' && now - Date.parse(x.submittedAt) >= DELAY)){
            const enc = this.store.find('encounters', a.encounterId);
            const insured = enc?.paymentClass === 'Insurance';
            let approved = true;
            let remarks = '';
            if (a.channel === 'PriorAuth') {
                if (/^\s*Z/i.test(a.diagnosis)) {
                    approved = false;
                    remarks = 'Diagnosis does not support medical necessity';
                } else if (a.requestedAmount > PA_LIMIT) {
                    approved = false;
                    remarks = `Exceeds the per-request limit of ${PA_LIMIT.toLocaleString()}`;
                } else remarks = 'Approved as requested';
            } else if (insured && a.requestedAmount > ERX_LIMIT) {
                approved = false;
                remarks = `Exceeds the pharmacy benefit limit of ${ERX_LIMIT.toLocaleString()}`;
            } else remarks = insured ? 'Prescription approved by payer' : 'Prescription validated';
            const status = approved ? 'Approved' : 'Rejected';
            this.store.update('approvals', a.id, {
                status,
                remarks,
                approvedAmount: approved ? a.requestedAmount : 0,
                authorizationNo: approved ? `AUTH-${a.approvalNo.replace(/\D/g, '')}-${String(now).slice(-4)}` : '',
                respondedAt: new Date().toISOString()
            });
            for (const id of a.orderIds ?? []){
                const o = this.store.find('orders', id);
                if (!o) continue;
                if (a.channel === 'eRx') this.store.update('orders', id, {
                    erxStatus: status,
                    ...o.priorAuthRequired ? {
                        priorAuthStatus: status
                    } : {}
                });
                else this.store.update('orders', id, {
                    priorAuthStatus: status
                });
            }
        }
    }
    decorate(a) {
        const p = this.store.find('patients', a.patientId);
        const enc = this.store.find('encounters', a.encounterId);
        const lines = (a.orderIds ?? []).map((id)=>this.store.find('orders', id)).filter(Boolean);
        return {
            ...a,
            patientName: p ? `${p.firstName} ${p.lastName}` : '',
            mrn: p?.mrn ?? '',
            encNo: enc?.encNo ?? '',
            payerName: this.store.find('payers', a.payerId)?.name ?? 'Self-pay',
            lines: lines.map((l)=>({
                    id: l.id,
                    code: l.code,
                    name: l.name,
                    qty: l.qty,
                    net: l.net
                })),
            itemsLabel: lines.map((l)=>l.name).join(', ')
        };
    }
    forEncounter(encounterId) {
        this.settle();
        return this.store.all('approvals').filter((a)=>a.encounterId === encounterId).sort((a, b)=>b.submittedAt.localeCompare(a.submittedAt)).map((a)=>this.decorate(a));
    }
    list(q) {
        this.settle();
        return paginate(this.store.all('approvals').map((a)=>this.decorate(a)), {
            sort: 'submittedAt',
            dir: 'desc',
            ...q
        }, [
            'approvalNo',
            'patientName',
            'mrn',
            'encNo',
            'itemsLabel',
            'payerName',
            'authorizationNo'
        ]);
    }
}
