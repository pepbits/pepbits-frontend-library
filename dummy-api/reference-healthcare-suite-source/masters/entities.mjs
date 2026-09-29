// Adapted from healthcare-suite/backend/src/masters/entities.ts. Reproduce with ../reference-healthcare-suite-import.mjs.
import '../common/csv-store.service.mjs';
const timeOrder = (r)=>{
    const e = {};
    if (r.startTime && r.endTime && r.startTime >= r.endTime) e.endTime = 'End time must be after the start time';
    return e;
};
const dateOrder = (from, to)=>(r)=>{
        const e = {};
        if (r[from] && r[to] && r[from] > r[to]) e[to] = 'Must be on or after the start date';
        return e;
    };
export const ENTITIES = {
    facilities: {
        table: 'facilities',
        idPrefix: 'F',
        label: 'Facility',
        search: [
            'code',
            'name',
            'city',
            'licenseNo'
        ],
        required: [
            'code',
            'name',
            'type'
        ],
        unique: [
            'code'
        ]
    },
    departments: {
        table: 'departments',
        idPrefix: 'D',
        label: 'Department',
        search: [
            'code',
            'name',
            'type'
        ],
        required: [
            'code',
            'name',
            'facilityId',
            'type'
        ],
        unique: [
            'code'
        ],
        refs: [
            {
                field: 'facilityId',
                table: 'facilities',
                as: 'facilityName'
            }
        ]
    },
    specialties: {
        table: 'specialties',
        idPrefix: 'S',
        label: 'Specialty',
        search: [
            'code',
            'name'
        ],
        required: [
            'code',
            'name',
            'departmentId'
        ],
        unique: [
            'code'
        ],
        refs: [
            {
                field: 'departmentId',
                table: 'departments',
                as: 'departmentName'
            }
        ]
    },
    providers: {
        table: 'providers',
        idPrefix: 'P',
        label: 'Provider',
        search: [
            'code',
            'name',
            'providerType',
            'licenseNo',
            'phone',
            'email'
        ],
        required: [
            'code',
            'name',
            'providerType',
            'gender',
            'departmentId'
        ],
        unique: [
            'code',
            'licenseNo'
        ],
        refs: [
            {
                field: 'departmentId',
                table: 'departments',
                as: 'departmentName'
            },
            {
                field: 'specialtyId',
                table: 'specialties',
                as: 'specialtyName'
            }
        ],
        validate: (r)=>{
            const e = {};
            if ([
                'Doctor',
                'Lab Doctor',
                'Pharmacist',
                'Nurse',
                'Physiotherapist'
            ].includes(r.providerType) && !r.licenseNo) e.licenseNo = 'A licence number is required for licensed clinicians';
            if (r.email && !/^\S+@\S+\.\S+$/.test(r.email)) e.email = 'Enter a valid email address';
            return e;
        }
    },
    payers: {
        table: 'payers',
        idPrefix: 'PY',
        label: 'Payer',
        search: [
            'code',
            'name',
            'payerType',
            'regulatorId'
        ],
        required: [
            'code',
            'name',
            'payerType'
        ],
        unique: [
            'code'
        ]
    },
    tpas: {
        table: 'tpas',
        idPrefix: 'T',
        label: 'TPA',
        search: [
            'code',
            'name',
            'regulatorId'
        ],
        required: [
            'code',
            'name'
        ],
        unique: [
            'code'
        ]
    },
    'insurance-plans': {
        table: 'insurance_plans',
        idPrefix: 'PL',
        label: 'Plan',
        search: [
            'code',
            'name',
            'planCategory'
        ],
        required: [
            'code',
            'name',
            'payerId',
            'tpaId'
        ],
        unique: [
            'code'
        ],
        refs: [
            {
                field: 'payerId',
                table: 'payers',
                as: 'payerName'
            },
            {
                field: 'tpaId',
                table: 'tpas',
                as: 'tpaName'
            }
        ]
    },
    networks: {
        table: 'networks',
        idPrefix: 'N',
        label: 'Network',
        search: [
            'code',
            'name'
        ],
        required: [
            'code',
            'name',
            'planId',
            'priceListId'
        ],
        unique: [
            'code'
        ],
        refs: [
            {
                field: 'planId',
                table: 'insurance_plans',
                as: 'planName'
            },
            {
                field: 'priceListId',
                table: 'price_lists',
                as: 'priceListName'
            }
        ],
        validate: (r)=>{
            const e = {};
            if (Number(r.copayPct) < 0 || Number(r.copayPct) > 100) e.copayPct = 'Co-pay must be between 0 and 100';
            return e;
        }
    },
    items: {
        table: 'items',
        idPrefix: 'I',
        label: 'Item',
        search: [
            'code',
            'name',
            'genericName',
            'category'
        ],
        required: [
            'code',
            'name',
            'category',
            'uom',
            'basePrice'
        ],
        unique: [
            'code'
        ],
        validate: (r)=>Number(r.basePrice) < 0 ? {
                basePrice: 'Price cannot be negative'
            } : {}
    },
    services: {
        table: 'services',
        idPrefix: 'V',
        label: 'Service',
        search: [
            'code',
            'name',
            'category'
        ],
        required: [
            'code',
            'name',
            'category',
            'basePrice'
        ],
        unique: [
            'code'
        ],
        refs: [
            {
                field: 'departmentId',
                table: 'departments',
                as: 'departmentName'
            }
        ]
    },
    'price-lists': {
        table: 'price_lists',
        idPrefix: 'PL-',
        label: 'Contract',
        search: [
            'code',
            'name',
            'contractType'
        ],
        required: [
            'code',
            'name',
            'contractType',
            'validFrom',
            'validTo'
        ],
        unique: [
            'code'
        ],
        refs: [
            {
                field: 'payerId',
                table: 'payers',
                as: 'payerName'
            }
        ],
        validate: dateOrder('validFrom', 'validTo')
    },
    resources: {
        table: 'resources',
        idPrefix: 'R',
        label: 'Resource',
        search: [
            'code',
            'name',
            'resourceType'
        ],
        required: [
            'code',
            'name',
            'resourceType',
            'departmentId'
        ],
        unique: [
            'code'
        ],
        refs: [
            {
                field: 'providerId',
                table: 'providers',
                as: 'providerName'
            },
            {
                field: 'departmentId',
                table: 'departments',
                as: 'departmentName'
            }
        ],
        validate: (r)=>r.resourceType === 'Provider' && !r.providerId ? {
                providerId: 'Choose the provider this resource books for'
            } : {}
    },
    'resource-schedules': {
        table: 'resource_schedules',
        idPrefix: 'RS',
        label: 'Schedule',
        search: [
            'resourceName',
            'days'
        ],
        required: [
            'resourceId',
            'days',
            'startTime',
            'endTime',
            'slotMinutes',
            'validFrom',
            'validTo'
        ],
        refs: [
            {
                field: 'resourceId',
                table: 'resources',
                as: 'resourceName'
            }
        ],
        lookupLabel: (r)=>`${r.resourceName} ${r.days} ${r.startTime}-${r.endTime}`,
        validate: (r)=>({
                ...timeOrder(r),
                ...dateOrder('validFrom', 'validTo')(r),
                ...Number(r.slotMinutes) < 5 ? {
                    slotMinutes: 'Slots must be at least 5 minutes'
                } : {}
            })
    },
    'resource-blocks': {
        table: 'resource_blocks',
        idPrefix: 'RB',
        label: 'Block',
        search: [
            'resourceName',
            'reason',
            'date'
        ],
        required: [
            'resourceId',
            'date',
            'startTime',
            'endTime',
            'reason'
        ],
        refs: [
            {
                field: 'resourceId',
                table: 'resources',
                as: 'resourceName'
            }
        ],
        lookupLabel: (r)=>`${r.resourceName} ${r.date}`,
        validate: timeOrder
    }
};
