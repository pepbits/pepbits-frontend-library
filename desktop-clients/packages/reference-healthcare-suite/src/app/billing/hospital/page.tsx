'use client';
import {useLocalization as useHealthcareLocalization} from '@pepbits/ops-ui';
import { Suspense } from 'react';
import { BillingWorkbench } from '../../../components/billing/BillingWorkbench';
import { usePageHeader } from '../../../lib/session';

export default function HospitalBillingPage() {
 const {t:healthcareT}=useHealthcareLocalization();
  usePageHeader(healthcareT("Hospital billing"), healthcareT("Consultations, procedures, lab and radiology"));
  return <Suspense><BillingWorkbench key="Hospital" category="Hospital" /></Suspense>;
}
