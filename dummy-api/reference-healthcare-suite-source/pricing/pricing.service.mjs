// Adapted from healthcare-suite/backend/src/pricing/pricing.service.ts. Reproduce with ../reference-healthcare-suite-import.mjs.
import { BadRequestException, NotFoundException } from '../runtime.mjs';
import { CsvStore } from '../common/csv-store.service.mjs';
import { round2, todayIso } from '../common/query.mjs';
export class PricingService {
    store;
    constructor(store){
        this.store = store;
    }
    catalogEntry(code) {
        const item = this.store.all('items').find((i)=>i.code === code);
        if (item) return {
            kind: 'item',
            row: item
        };
        const svc = this.store.all('services').find((s)=>s.code === code);
        if (svc) return {
            kind: 'service',
            row: svc
        };
        throw new NotFoundException(`No item or service with code ${code}`);
    }
    coverage(policyId) {
        if (!policyId) return null;
        const policy = this.store.find('patient_policies', policyId);
        if (!policy) throw new NotFoundException(`Policy ${policyId} was not found`);
        const network = this.store.get('networks', policy.networkId, 'Network');
        const plan = this.store.get('insurance_plans', policy.planId, 'Plan');
        const payer = this.store.get('payers', policy.payerId, 'Payer');
        const tpa = this.store.find('tpas', policy.tpaId);
        const priceList = this.store.find('price_lists', network.priceListId);
        const t = todayIso();
        return {
            policy,
            payer,
            tpa,
            plan,
            network,
            priceList,
            copayPct: network.copayPct,
            deductible: network.deductible,
            maxCopayPerVisit: network.maxCopayPerVisit,
            priorAuthLimit: network.priorAuthLimit,
            active: policy.status === 'Active' && policy.validFrom <= t && policy.validTo >= t
        };
    }
    quote(code, qty = 1, policyId) {
        if (!(qty > 0)) throw new BadRequestException('Quantity must be greater than zero');
        const { kind, row } = this.catalogEntry(code);
        const cov = this.coverage(policyId);
        const base = Number(row.basePrice) || 0;
        const listId = cov?.priceList?.id ?? 'PL-CASH';
        const list = this.store.find('price_lists', listId);
        const line = this.store.all('price_list_items').find((l)=>l.priceListId === listId && l.code === code);
        let unit = base;
        let covered = !!cov;
        let contractPA = false;
        let priceSource = 'Base tariff';
        if (line) {
            unit = line.price;
            covered = !!cov && line.covered;
            contractPA = line.priorAuth;
            priceSource = `${list?.name ?? listId} (contract price)`;
        } else if (list && list.defaultDiscountPct) {
            unit = base * (1 - list.defaultDiscountPct / 100);
            priceSource = `${list.name} (${list.defaultDiscountPct}% off base)`;
        }
        unit = round2(unit);
        const gross = round2(base * qty);
        const net = round2(unit * qty);
        const copayPct = cov && covered ? cov.copayPct : 100;
        const patientShare = cov ? round2(covered ? net * cov.copayPct / 100 : net) : net;
        const payerShare = round2(net - patientShare);
        const isDrug = kind === 'item' && row.category === 'Drug';
        const priorAuthRequired = !!cov && covered && (contractPA || cov.priorAuthLimit > 0 && net > cov.priorAuthLimit);
        return {
            code,
            name: row.name,
            kind,
            category: row.category,
            billingCategory: isDrug ? 'Pharmacy' : 'Hospital',
            qty,
            basePrice: base,
            unitPrice: unit,
            gross,
            discount: round2(gross - net),
            net,
            covered,
            copayPct,
            patientShare,
            payerShare,
            priorAuthRequired,
            erxRequired: isDrug && !!row.requiresErx,
            priceSource,
            stockQty: kind === 'item' ? row.stockQty : null,
            uom: row.uom ?? 'Each'
        };
    }
    search(q, kind, policyId, encounterType) {
        const term = (q ?? '').trim().toLowerCase();
        const match = (r)=>!term || [
                r.code,
                r.name,
                r.genericName,
                r.category
            ].some((v)=>String(v ?? '').toLowerCase().includes(term));
        let rows = [];
        if (kind !== 'service') rows = rows.concat(this.store.all('items').filter((r)=>r.status === 'Active' && match(r)));
        if (kind !== 'item' && encounterType !== 'Pharmacy') rows = rows.concat(this.store.all('services').filter((r)=>r.status === 'Active' && match(r)));
        return rows.slice(0, 25).map((r)=>this.quote(r.code, 1, policyId || null));
    }
    contractGrid(priceListId, kind, search) {
        const list = this.store.get('price_lists', priceListId, 'Contract');
        const lines = this.store.all('price_list_items').filter((l)=>l.priceListId === priceListId);
        const term = (search ?? '').toLowerCase();
        const cat = [
            ...kind === 'service' ? [] : this.store.all('items').map((r)=>({
                    ...r,
                    kind: 'item'
                })),
            ...kind === 'item' ? [] : this.store.all('services').map((r)=>({
                    ...r,
                    kind: 'service'
                }))
        ].filter((r)=>!term || `${r.code} ${r.name} ${r.category}`.toLowerCase().includes(term));
        return {
            priceList: list,
            rows: cat.map((r)=>{
                const l = lines.find((x)=>x.code === r.code);
                return {
                    code: r.code,
                    name: r.name,
                    kind: r.kind,
                    category: r.category,
                    basePrice: r.basePrice,
                    defaultPrice: round2(r.basePrice * (1 - (list.defaultDiscountPct || 0) / 100)),
                    hasContractLine: !!l,
                    price: l ? l.price : null,
                    covered: l ? l.covered : true,
                    priorAuth: l ? l.priorAuth : false
                };
            })
        };
    }
    saveContractLines(priceListId, lines) {
        this.store.get('price_lists', priceListId, 'Contract');
        let changed = 0;
        for (const l of lines ?? []){
            this.catalogEntry(l.code);
            const existing = this.store.all('price_list_items').find((x)=>x.priceListId === priceListId && x.code === l.code);
            const isDefault = (l.price === null || l.price === undefined || String(l.price) === '') && l.covered && !l.priorAuth;
            if (isDefault) {
                if (existing) {
                    this.store.remove('price_list_items', existing.id);
                    changed++;
                }
                continue;
            }
            const price = l.price === null || String(l.price) === '' ? this.catalogEntry(l.code).row.basePrice : Number(l.price);
            if (price < 0) throw new BadRequestException(`Price for ${l.code} cannot be negative`);
            if (existing) this.store.update('price_list_items', existing.id, {
                price,
                covered: l.covered,
                priorAuth: l.priorAuth
            });
            else this.store.insert('price_list_items', {
                id: this.store.nextKey('price_list_items', 'id', 'PLI', 4),
                priceListId,
                code: l.code,
                price,
                covered: l.covered,
                priorAuth: l.priorAuth
            });
            changed++;
        }
        return {
            changed
        };
    }
}
