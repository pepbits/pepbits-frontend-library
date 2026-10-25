// Adapted from healthcare-suite/backend/src/billing/billing.service.ts. Reproduce with ../reference-healthcare-suite-import.mjs.
import { BadRequestException } from '../runtime.mjs';
import { CsvStore } from '../common/csv-store.service.mjs';
import { ValidationFailed } from '../common/errors.mjs';
import { localDate, nowIso, paginate, round2 } from '../common/query.mjs';
import { ApprovalsService } from '../orders/approvals.service.mjs';
import { OrdersService } from '../orders/orders.service.mjs';
import { PatientsService } from '../patients/patients.service.mjs';
import { PricingService } from '../pricing/pricing.service.mjs';
const cat = (c)=>c === 'Pharmacy' ? 'Pharmacy' : 'Hospital';
export class BillingService {
    store;
    orders;
    approvals;
    pricing;
    patients;
    constructor(store, orders, approvals, pricing, patients){
        this.store = store;
        this.orders = orders;
        this.approvals = approvals;
        this.pricing = pricing;
        this.patients = patients;
    }
    liveInvoices(encounterId) {
        return this.store.all('invoices').filter((i)=>i.encounterId === encounterId && i.status !== 'Cancelled');
    }
    blockers(l) {
        const r = [];
        if (l.erxRequired && l.erxStatus !== 'Approved') {
            r.push({
                Pending: 'eRx awaiting payer response',
                Rejected: 'eRx rejected: resubmit or change the medicine'
            }[l.erxStatus] ?? 'eRx not sent yet');
        } else if (l.priorAuthRequired && !l.erxRequired) {
            if (l.priorAuthStatus === 'Pending') r.push('Prior approval awaiting payer response');
            if (l.priorAuthStatus === 'Required') r.push('Prior approval not requested yet');
        }
        if (l.kind === 'item') {
            const item = this.store.all('items').find((i)=>i.code === l.code);
            if (item && item.stockQty < l.qty) r.push(`Only ${item.stockQty} ${item.uom} in stock`);
        }
        return r;
    }
    preview(encounterId, category) {
        this.approvals.settle();
        const c = cat(category);
        const enc = this.store.get('encounters', encounterId, 'Encounter');
        const cov = enc.paymentClass === 'Insurance' && enc.policyId ? this.pricing.coverage(enc.policyId) : null;
        const signed = this.orders.forEncounter(encounterId).filter((o)=>o.billingCategory === c && o.status === 'Signed');
        const lines = [];
        const blocked = [];
        for (const l of signed){
            const reasons = this.blockers(l);
            if (reasons.length) {
                blocked.push({
                    ...l,
                    reasons
                });
                continue;
            }
            const rejected = l.priorAuthStatus === 'Rejected';
            lines.push({
                ...l,
                patientShare: rejected ? l.net : l.patientShare,
                payerShare: rejected ? 0 : l.payerShare,
                note: rejected ? 'Approval rejected: patient pays' : !l.covered && cov ? 'Not covered by plan' : '',
                copayApplies: !!cov && l.covered && !rejected
            });
        }
        const adjustments = [];
        let patient = round2(lines.reduce((s, l)=>s + l.patientShare, 0));
        let payer = round2(lines.reduce((s, l)=>s + l.payerShare, 0));
        let copay = round2(lines.filter((l)=>l.copayApplies).reduce((s, l)=>s + l.patientShare, 0));
        const prior = this.liveInvoices(encounterId);
        if (cov && lines.length) {
            if (c === 'Hospital' && cov.deductible > 0 && !prior.some((i)=>i.category === 'Hospital')) {
                const ded = round2(Math.min(cov.deductible, payer));
                if (ded > 0) {
                    patient += ded;
                    payer -= ded;
                    adjustments.push({
                        label: `Deductible (${cov.network.name})`,
                        amount: ded
                    });
                }
            }
            if (cov.maxCopayPerVisit > 0) {
                const already = round2(prior.reduce((s, i)=>s + (i.copay || 0), 0));
                const over = round2(already + copay - cov.maxCopayPerVisit);
                if (over > 0) {
                    const cut = Math.min(over, copay);
                    patient -= cut;
                    payer += cut;
                    copay -= cut;
                    adjustments.push({
                        label: `Co-pay capped at ${cov.maxCopayPerVisit} per visit`,
                        amount: -round2(cut)
                    });
                }
            }
        }
        const pSummary = this.patients.summary(this.store.get('patients', enc.patientId));
        return {
            encounter: {
                id: enc.id,
                encNo: enc.encNo,
                encounterType: enc.encounterType,
                paymentClass: enc.paymentClass,
                status: enc.status,
                createdAt: enc.createdAt,
                eligibilityStatus: enc.eligibilityStatus,
                eligibilityRef: enc.eligibilityRef,
                providerName: this.store.find('providers', enc.providerId)?.name ?? '',
                departmentName: this.store.find('departments', enc.departmentId)?.name ?? ''
            },
            patient: pSummary,
            coverage: cov ? {
                payerName: cov.payer.name,
                tpaName: cov.tpa?.name ?? '',
                planName: cov.plan.name,
                networkName: cov.network.name,
                copayPct: cov.copayPct,
                deductible: cov.deductible,
                maxCopayPerVisit: cov.maxCopayPerVisit
            } : null,
            category: c,
            lines,
            blocked,
            adjustments,
            priorInvoices: prior.filter((i)=>i.category === c).map(({ lines: _l, payments: _p, ...r })=>r),
            totals: {
                gross: round2(lines.reduce((s, l)=>s + l.gross, 0)),
                discount: round2(lines.reduce((s, l)=>s + l.discount, 0)),
                net: round2(lines.reduce((s, l)=>s + l.net, 0)),
                patientShare: round2(patient),
                payerShare: round2(payer),
                copay: round2(copay)
            }
        };
    }
    pending(q) {
        this.approvals.settle();
        const c = cat(q.category);
        const byEnc = new Map();
        for (const o of this.store.all('orders').filter((x)=>x.billingCategory === c && x.status === 'Signed')){
            byEnc.set(o.encounterId, [
                ...byEnc.get(o.encounterId) ?? [],
                o
            ]);
        }
        const rows = [
            ...byEnc.entries()
        ].map(([encId, ls])=>{
            const e = this.store.find('encounters', encId);
            const p = this.store.find('patients', e.patientId);
            const pol = e.policyId ? this.store.find('patient_policies', e.policyId) : undefined;
            const blocked = ls.filter((l)=>this.blockers(l).length).length;
            return {
                encounterId: encId,
                encNo: e.encNo,
                createdAt: e.createdAt,
                encounterType: e.encounterType,
                paymentClass: e.paymentClass,
                patientName: p ? `${p.firstName} ${p.lastName}` : '',
                mrn: p?.mrn ?? '',
                payerName: pol ? this.store.find('payers', pol.payerId)?.name ?? '' : 'Self-pay',
                providerName: this.store.find('providers', e.providerId)?.name ?? '',
                lineCount: ls.length,
                readyCount: ls.length - blocked,
                blockedCount: blocked,
                estimatedNet: round2(ls.reduce((s, l)=>s + l.net, 0))
            };
        });
        return paginate(rows, {
            sort: 'createdAt',
            dir: 'desc',
            pageSize: 100,
            search: q.search
        }, [
            'encNo',
            'patientName',
            'mrn',
            'payerName',
            'providerName'
        ]);
    }
    create(body) {
        const pv = this.preview(body.encounterId, body.category);
        const quantities = new Map();
        for (const line of pv.lines.filter((line)=>line.kind === 'item'))quantities.set(line.code, (quantities.get(line.code) ?? 0) + line.qty);
        for (const [code, qty] of quantities)if (this.pricing.catalogEntry(code).row.stockQty < qty) throw new ValidationFailed({
            stock: 'Combined quantities exceed available stock'
        });
        if (!pv.lines.length) throw new BadRequestException('Nothing is ready to bill for this encounter');
        const payments = (Array.isArray(body.payments) ? body.payments : []).filter((p)=>Number(p.amount) > 0);
        const e = {};
        payments.forEach((p, i)=>{
            if (![
                'Cash',
                'Card',
                'Online',
                'Advance'
            ].includes(p.mode)) e[`payments.${i}.mode`] = 'Choose a payment mode';
            if (p.mode === 'Card' && !String(p.reference ?? '').trim()) e[`payments.${i}.reference`] = 'Enter the card approval code';
        });
        const paid = round2(payments.reduce((s, p)=>s + Number(p.amount), 0));
        if (paid > pv.totals.patientShare + 0.009) e.payments = `Collected ${paid} is more than the patient share of ${pv.totals.patientShare}`;
        if (Object.keys(e).length) throw new ValidationFailed(e);
        const prefix = pv.category === 'Pharmacy' ? 'PH' : 'HB';
        const balance = round2(pv.totals.patientShare - paid);
        const inv = this.store.insert('invoices', {
            id: this.store.nextKey('invoices', 'id', 'IV', 6),
            invoiceNo: this.store.nextKey('invoices', 'invoiceNo', prefix, 7),
            category: pv.category,
            encounterId: pv.encounter.id,
            patientId: pv.patient.id,
            policyId: pv.encounter.paymentClass === 'Insurance' ? this.store.find('encounters', pv.encounter.id)?.policyId ?? '' : '',
            paymentClass: pv.encounter.paymentClass,
            lines: pv.lines.map((l)=>({
                    orderId: l.id,
                    code: l.code,
                    name: l.name,
                    kind: l.kind,
                    qty: l.qty,
                    unitPrice: l.unitPrice,
                    gross: l.gross,
                    discount: l.discount,
                    net: l.net,
                    patientShare: l.patientShare,
                    payerShare: l.payerShare,
                    note: l.note,
                    authorizationNo: this.authFor(l)
                })),
            adjustments: pv.adjustments,
            ...pv.totals,
            paid,
            balance,
            payments: payments.map((p)=>({
                    mode: p.mode,
                    amount: round2(Number(p.amount)),
                    reference: p.reference ?? '',
                    at: nowIso()
                })),
            status: balance <= 0 ? 'Paid' : paid > 0 ? 'Partially paid' : 'Unpaid',
            claimStatus: pv.totals.payerShare > 0 ? 'Ready to claim' : 'Not applicable',
            createdAt: nowIso(),
            createdBy: 'U001',
            cancelledAt: '',
            cancelReason: ''
        });
        for (const l of pv.lines){
            this.store.update('orders', l.id, {
                status: 'Billed',
                invoiceId: inv.id
            });
            if (l.kind === 'item') {
                const item = this.store.all('items').find((i)=>i.code === l.code);
                if (item) this.store.update('items', item.id, {
                    stockQty: item.stockQty - l.qty
                });
            }
        }
        const enc = this.store.get('encounters', pv.encounter.id);
        if (enc.encounterType === 'Pharmacy' && !this.orders.forEncounter(enc.id).some((o)=>[
                'Draft',
                'Signed'
            ].includes(o.status))) {
            this.store.update('encounters', enc.id, {
                status: 'Completed'
            });
        }
        return this.get(inv.id);
    }
    authFor(l) {
        const id = l.erxId || l.approvalId;
        return id ? this.store.find('approvals', id)?.authorizationNo ?? '' : '';
    }
    collect(id, body) {
        const inv = this.store.get('invoices', id, 'Invoice');
        if (inv.status === 'Cancelled') throw new BadRequestException('This invoice is cancelled');
        const amount = round2(Number(body.amount));
        if (!(amount > 0)) throw new ValidationFailed({
            amount: 'Enter an amount greater than zero'
        });
        if (amount > inv.balance + 0.009) throw new ValidationFailed({
            amount: `Balance due is only ${inv.balance}`
        });
        const payments = [
            ...inv.payments ?? [],
            {
                mode: body.mode ?? 'Cash',
                amount,
                reference: body.reference ?? '',
                at: nowIso()
            }
        ];
        const paid = round2(inv.paid + amount);
        const balance = round2(inv.patientShare - paid);
        this.store.update('invoices', id, {
            payments,
            paid,
            balance,
            status: balance <= 0 ? 'Paid' : 'Partially paid'
        });
        return this.get(id);
    }
    cancel(id, reason) {
        const inv = this.store.get('invoices', id, 'Invoice');
        if (inv.status === 'Cancelled') throw new BadRequestException('Invoice is already cancelled');
        if (!String(reason ?? '').trim()) throw new ValidationFailed({
            reason: 'Give a reason for cancelling'
        });
        for (const l of inv.lines ?? []){
            const o = this.store.find('orders', l.orderId);
            if (o) this.store.update('orders', o.id, {
                status: 'Signed',
                invoiceId: ''
            });
            if (l.kind === 'item') {
                const item = this.store.all('items').find((i)=>i.code === l.code);
                if (item) this.store.update('items', item.id, {
                    stockQty: item.stockQty + l.qty
                });
            }
        }
        this.store.update('invoices', id, {
            status: 'Cancelled',
            claimStatus: 'Not applicable',
            cancelledAt: nowIso(),
            cancelReason: reason
        });
        return this.get(id);
    }
    get(id) {
        const inv = this.store.get('invoices', id, 'Invoice');
        const enc = this.store.find('encounters', inv.encounterId);
        const pol = inv.policyId ? this.store.find('patient_policies', inv.policyId) : undefined;
        return {
            ...inv,
            encNo: enc?.encNo ?? '',
            providerName: enc ? this.store.find('providers', enc.providerId)?.name ?? '' : '',
            patient: this.patients.summary(this.store.get('patients', inv.patientId)),
            policy: pol ? this.patients.expandPolicy(pol) : null,
            facility: this.store.find('facilities', enc?.facilityId ?? 'F001') ?? null
        };
    }
    list(q) {
        const { date, ...rest } = q;
        const rows = this.store.all('invoices').filter((i)=>!date || localDate(i.createdAt) === date).map(({ lines: _l, payments: _p, ...i })=>{
            const p = this.store.find('patients', i.patientId);
            const enc = this.store.find('encounters', i.encounterId);
            const pol = i.policyId ? this.store.find('patient_policies', i.policyId) : undefined;
            return {
                ...i,
                patientName: p ? `${p.firstName} ${p.lastName}` : '',
                mrn: p?.mrn ?? '',
                encNo: enc?.encNo ?? '',
                payerName: pol ? this.store.find('payers', pol.payerId)?.name ?? '' : 'Self-pay'
            };
        });
        return paginate(rows, {
            sort: 'createdAt',
            dir: 'desc',
            ...rest
        }, [
            'invoiceNo',
            'patientName',
            'mrn',
            'encNo',
            'payerName'
        ]);
    }
}
