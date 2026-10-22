import type { Metadata } from 'next';
import { Suspense } from 'react';
import { EditorSkeleton } from '@/components/patients/PatientEditor';
import { PatientWorkspace } from '@/components/patients/PatientWorkspace';

export const metadata: Metadata = { title: 'Patients' };

export default function PatientsPage() {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <PatientWorkspace />
    </Suspense>
  );
}
