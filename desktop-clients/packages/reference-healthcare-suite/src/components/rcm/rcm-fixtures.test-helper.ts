import type {RcmWorkspace} from '../../lib/rcm-contract';
/** Synthetic isolated records for component acceptance; never runtime seed data. */
export function rcmFixture():RcmWorkspace {
 return {version:0,currency:'AED',capabilities:{read:true,claims:true,finance:true,configure:true,approve:true,export:true},
  invoices:[{id:'RCM-INV-001',patientId:'PT00001',status:'Open',totalMinor:100000,paidMinor:0,adjustmentMinor:0,creditMinor:0,outstandingMinor:100000,patientShareMinor:20000,payerShareMinor:80000,patientPaidMinor:0,payerPaidMinor:0,patientOutstandingMinor:20000,payerOutstandingMinor:80000,patientCreditMinor:0,payerCreditMinor:0}],
  moneyProviderConfigured:false,payers:[],payerPolicies:[],tenantPayerPolicies:[],glExports:[],claims:[],payerSequences:[],exchangeProfiles:[],exchanges:[],remittances:[],credits:[],deposits:[],refunds:[],packages:[],packageVersions:[],entitlements:[],reservations:[],pricingVersions:[],drgConfigurations:[],drgCases:[],journal:[],outbox:[],collections:[],
  reports:{outstandingMinor:100000,cashMinor:0,creditsMinor:0,depositsMinor:0,aging:[{bucket:'Current',amountMinor:100000}],trialBalance:[],payerExposure:[],journalBalanced:true},
 };
}
