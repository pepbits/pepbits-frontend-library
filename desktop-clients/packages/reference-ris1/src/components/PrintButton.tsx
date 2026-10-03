'use client';
import {DiagnosticButton} from '@pepbits/reference-diagnostics';
import { Printer } from 'lucide-react';
import { LocalizedText as ReferenceText } from '@pepbits/ops-ui';


export default function PrintButton() {
  return (
    <div className="no-print fixed right-4 top-4 flex gap-2">
      <DiagnosticButton className="btn-secondary" onClick={() => window.close()}><ReferenceText message="Close" /></DiagnosticButton>
      <DiagnosticButton className="btn-primary" onClick={() => window.print()}><Printer size={16} /><ReferenceText message="Print" /></DiagnosticButton>
    </div>
  );
}
