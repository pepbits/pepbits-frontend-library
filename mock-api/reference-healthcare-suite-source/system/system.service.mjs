// Adapted from healthcare-suite/backend/src/system/system.service.ts. Reproduce with ../reference-healthcare-suite-import.mjs.
import { Logger } from '../runtime.mjs';
import { CsvStore } from '../common/csv-store.service.mjs';
import { localDate, round2, todayIso } from '../common/query.mjs';
import { ApprovalsService } from '../orders/approvals.service.mjs';
import { SchedulingService } from '../scheduling/scheduling.service.mjs';
export class SystemService {
    store;
    scheduling;
    approvals;
    log = new Logger('Seeder');
    constructor(store, scheduling, approvals){
        this.store = store;
        this.scheduling = scheduling;
        this.approvals = approvals;
    }
    session() {
        const user = this.store.all('users')[0];
        const ids = String(user?.facilityIds ?? '').split('|');
        return {
            user: user ? {
                id: user.id,
                name: user.name,
                role: user.role,
                email: user.email,
                initials: user.name.split(' ').map((s)=>s[0]).slice(0, 2).join('')
            } : null,
            facilities: this.store.all('facilities').filter((f)=>f.status === 'Active' && (!ids[0] || ids.includes(f.id))),
            defaultFacilityId: user?.defaultFacilityId ?? 'F001',
            currency: process.env.CURRENCY ?? 'AED',
            today: todayIso()
        };
    }
    dashboard(date = todayIso()) {
        this.approvals.settle();
        const appts = this.store.all('appointments').filter((a)=>a.date === date);
        const encs = this.store.all('encounters').filter((e)=>localDate(e.createdAt) === date);
        const inv = this.store.all('invoices').filter((i)=>localDate(i.createdAt) === date && i.status !== 'Cancelled');
        const signed = this.store.all('orders').filter((o)=>o.status === 'Signed');
        const count = (xs, k)=>xs.reduce((m, x)=>({
                    ...m,
                    [x[k]]: (m[x[k]] ?? 0) + 1
                }), {});
        const nowHm = new Date().toTimeString().slice(0, 5);
        const pending = this.approvals.list({
            status: 'Pending',
            pageSize: 6
        });
        return {
            date,
            appointments: {
                total: appts.filter((a)=>a.status !== 'Cancelled').length,
                byStatus: count(appts, 'status')
            },
            encounters: {
                total: encs.length,
                byStatus: count(encs, 'status'),
                byType: count(encs, 'encounterType')
            },
            approvals: {
                pending: pending.total,
                recentPending: pending.data
            },
            unbilled: {
                hospital: new Set(signed.filter((o)=>o.billingCategory === 'Hospital').map((o)=>o.encounterId)).size,
                pharmacy: new Set(signed.filter((o)=>o.billingCategory === 'Pharmacy').map((o)=>o.encounterId)).size
            },
            revenue: {
                hospital: round2(inv.filter((i)=>i.category === 'Hospital').reduce((s, i)=>s + i.net, 0)),
                pharmacy: round2(inv.filter((i)=>i.category === 'Pharmacy').reduce((s, i)=>s + i.net, 0)),
                collected: round2(inv.reduce((s, i)=>s + i.paid, 0)),
                receivable: round2(inv.reduce((s, i)=>s + i.payerShare, 0))
            },
            lowStock: this.store.all('items').filter((i)=>i.status === 'Active' && i.stockQty <= i.reorderLevel).map((i)=>({
                    id: i.id,
                    code: i.code,
                    name: i.name,
                    stockQty: i.stockQty,
                    reorderLevel: i.reorderLevel,
                    uom: i.uom
                })),
            upcoming: appts.filter((a)=>[
                    'Booked',
                    'Confirmed'
                ].includes(a.status) && (date !== todayIso() || a.endTime >= nowHm)).sort((a, b)=>a.startTime.localeCompare(b.startTime)).slice(0, 8).map((a)=>this.scheduling.decorate(a))
        };
    }
    onApplicationBootstrap() {
        if (this.store.all('appointments').length) return;
        const today = todayIso();
        if (!this.store.all('resource_blocks').some((b)=>b.date === today)) {
            this.store.insert('resource_blocks', {
                id: this.store.nextKey('resource_blocks', 'id', 'RB', 3),
                resourceId: 'R002',
                date: today,
                startTime: '13:00',
                endTime: '14:00',
                reason: 'Lunch break',
                status: 'Active'
            });
        }
        const plan = [
            [
                'R001',
                'PT00001',
                'Fever and sore throat',
                ''
            ],
            [
                'R001',
                'PT00002',
                'Diabetes review',
                ''
            ],
            [
                'R001',
                null,
                'New patient, cough',
                'Khalid Mansour|0501112233|Male'
            ],
            [
                'R002',
                'PT00003',
                'Hypertension follow-up',
                ''
            ],
            [
                'R002',
                'PT00006',
                'Annual check',
                ''
            ],
            [
                'R004',
                'PT00004',
                'Knee pain after football',
                ''
            ],
            [
                'R004',
                'PT00008',
                'Post-op review',
                ''
            ],
            [
                'R006',
                'PT00005',
                'Lower back pain',
                ''
            ],
            [
                'R003',
                'PT00007',
                'Child vaccination query',
                ''
            ]
        ];
        let made = 0;
        for (const day of [
            today,
            this.addDays(today, 1)
        ]){
            for (const [rid, pid, reason, guest] of plan){
                const resource = this.store.find('resources', rid);
                if (!resource) continue;
                const free = this.scheduling.resourceSlots(resource, day).filter((s)=>s.status === 'free');
                if (!free.length) continue;
                const slot = free[Math.min(made % 3 + 1, free.length - 1)];
                const [gn, gp, gg] = guest ? guest.split('|') : [];
                try {
                    this.scheduling.book({
                        resourceId: rid,
                        date: day,
                        startTime: slot.start,
                        patientId: pid ?? undefined,
                        guestName: gn,
                        guestPhone: gp,
                        guestGender: gg,
                        reason
                    });
                    made++;
                } catch  {}
            }
            if (made >= 5) break;
        }
        this.log.log(`Seeded ${made} demo appointments`);
    }
    addDays(iso, n) {
        const d = new Date(`${iso}T00:00:00`);
        d.setDate(d.getDate() + n);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
}
