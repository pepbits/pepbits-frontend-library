// Adapted from healthcare-suite/backend/src/orders/orders.service.ts. Reproduce with ../reference-healthcare-suite-import.mjs.
import { BadRequestException } from '../runtime.mjs';
import { CsvStore } from '../common/csv-store.service.mjs';
import { ValidationFailed } from '../common/errors.mjs';
import { nowIso } from '../common/query.mjs';
import { PricingService } from '../pricing/pricing.service.mjs';
const CLOSED = [
    'Completed',
    'Cancelled'
];
export class OrdersService {
    store;
    pricing;
    constructor(store, pricing){
        this.store = store;
        this.pricing = pricing;
    }
    policyFor(enc) {
        return enc.paymentClass === 'Insurance' ? enc.policyId || null : null;
    }
    forEncounter(encounterId) {
        return this.store.all('orders').filter((o)=>o.encounterId === encounterId && o.status !== 'Cancelled').sort((a, b)=>a.orderNo.localeCompare(b.orderNo));
    }
    createLine(enc, body, status = 'Draft') {
        if (CLOSED.includes(enc.status)) throw new BadRequestException(`Encounter ${enc.encNo} is ${enc.status.toLowerCase()}; reopen it to add orders`);
        const qty = Number(body.qty) || 1;
        const q = this.pricing.quote(body.code, qty, this.policyFor(enc));
        if (enc.encounterType === 'Pharmacy' && q.kind !== 'item') throw new BadRequestException('Pharmacy encounters can only order items and medicines');
        const provider = this.store.find('providers', enc.providerId);
        return this.store.insert('orders', {
            id: this.store.nextKey('orders', 'id', 'OL', 6),
            orderNo: this.store.nextKey('orders', 'orderNo', 'ORD', 6),
            encounterId: enc.id,
            patientId: enc.patientId,
            code: q.code,
            name: q.name,
            kind: q.kind,
            category: q.category,
            billingCategory: q.billingCategory,
            qty,
            uom: q.uom,
            dosage: body.dosage ?? '',
            frequency: body.frequency ?? '',
            durationDays: body.durationDays ?? 0,
            route: body.route ?? '',
            instructions: body.instructions ?? '',
            unitPrice: q.unitPrice,
            gross: q.gross,
            discount: q.discount,
            net: q.net,
            copayPct: q.copayPct,
            patientShare: q.patientShare,
            payerShare: q.payerShare,
            covered: q.covered,
            priorAuthRequired: q.priorAuthRequired,
            priorAuthStatus: q.priorAuthRequired ? 'Required' : 'NotRequired',
            approvalId: '',
            erxRequired: q.erxRequired,
            erxStatus: q.erxRequired ? 'Required' : 'NotRequired',
            erxId: '',
            status,
            orderedBy: provider?.name ?? '',
            orderedAt: nowIso(),
            invoiceId: ''
        });
    }
    add(encounterId, body) {
        if (!body.code) throw new ValidationFailed({
            code: 'Choose an item or service'
        });
        const enc = this.store.get('encounters', encounterId, 'Encounter');
        const line = this.createLine(enc, body);
        if (enc.status === 'Registered') this.store.update('encounters', enc.id, {
            status: 'In Consultation'
        });
        return line;
    }
    update(id, body) {
        const o = this.store.get('orders', id, 'Order line');
        if (o.status !== 'Draft') throw new BadRequestException('Only draft lines can be changed. Cancel and re-order instead.');
        const enc = this.store.get('encounters', o.encounterId, 'Encounter');
        const qty = body.qty !== undefined ? Number(body.qty) : o.qty;
        const q = this.pricing.quote(o.code, qty, this.policyFor(enc));
        const paReset = o.priorAuthStatus === 'Approved' && qty !== o.qty;
        return this.store.update('orders', id, {
            qty,
            dosage: body.dosage ?? o.dosage,
            frequency: body.frequency ?? o.frequency,
            durationDays: body.durationDays ?? o.durationDays,
            route: body.route ?? o.route,
            instructions: body.instructions ?? o.instructions,
            unitPrice: q.unitPrice,
            gross: q.gross,
            discount: q.discount,
            net: q.net,
            patientShare: q.patientShare,
            payerShare: q.payerShare,
            priorAuthRequired: q.priorAuthRequired,
            priorAuthStatus: q.priorAuthRequired ? paReset || o.priorAuthStatus === 'NotRequired' ? 'Required' : o.priorAuthStatus : 'NotRequired'
        });
    }
    cancel(id) {
        const o = this.store.get('orders', id, 'Order line');
        if (o.status === 'Billed') throw new BadRequestException('This line is already billed. Cancel the invoice first.');
        if (o.priorAuthStatus === 'Pending' || o.erxStatus === 'Pending') throw new BadRequestException('An approval is in progress for this line. Wait for the response before cancelling.');
        return this.store.update('orders', id, {
            status: 'Cancelled'
        });
    }
    sign(encounterId, orderIds) {
        const enc = this.store.get('encounters', encounterId, 'Encounter');
        const lines = this.forEncounter(encounterId).filter((o)=>o.status === 'Draft' && (!orderIds?.length || orderIds.includes(o.id)));
        if (!lines.length) throw new BadRequestException('There are no draft lines to sign');
        const missing = lines.filter((o)=>o.category === 'Drug' && (!o.dosage || !o.frequency));
        if (missing.length) throw new BadRequestException(`Add dosage and frequency before signing: ${missing.map((m)=>m.name).join(', ')}`);
        lines.forEach((o)=>this.store.update('orders', o.id, {
                status: 'Signed'
            }));
        if (enc.status === 'Registered') this.store.update('encounters', enc.id, {
            status: 'In Consultation'
        });
        return {
            signed: lines.length
        };
    }
}
