'use client';
import {useLocalization as useHealthcareLocalization} from '@pepbits/ops-ui';
import { Suspense } from 'react';
import { BillingWorkbench } from '../../../components/billing/BillingWorkbench';
import { usePageHeader } from '../../../lib/session';

export default function PharmacyBillingPage() {
 const {t:healthcareT}=useHealthcareLocalization();
  usePageHeader(healthcareT("Pharmacy billing"), healthcareT("Dispensed medicines and consumables"));
  return <Suspense><BillingWorkbench key="Pharmacy" category="Pharmacy" /></Suspense>;
}
