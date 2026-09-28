import Link from '../lib/navigation';
import { LocalizedText as ReferenceText } from '@pepbits/ops-ui';
import { useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';



export default function NotFound() {
 const referenceT = useReferenceLocalization().t;

  return (
    <div className="grid h-full min-h-[360px] place-items-center bg-bg p-6 text-center">
      <div>
        <p className="text-[length:calc(15px*var(--fs-scale))] font-semibold text-ink"><ReferenceText message="This page does not exist" /></p>
        <p className="mt-1 text-[length:calc(13px*var(--fs-scale))] text-ink-3"><ReferenceText message="Check the address, or head back to the dashboard." /></p>
        <Link href="/workspace/dashboard" className="mt-4 inline-flex h-8 items-center rounded-md bg-brand px-3 text-[length:calc(13px*var(--fs-scale))] font-medium text-white"><ReferenceText message="Go to dashboard" /></Link>
      </div>
    </div>
  );
}
