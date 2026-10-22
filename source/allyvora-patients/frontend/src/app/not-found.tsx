import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-24 text-center">
      <p className="font-cond text-5xl font-semibold text-brand">404</p>
      <h1 className="text-lg font-semibold">This page doesn’t exist</h1>
      <p className="text-ink-2">Check the address, or go back to the patient register.</p>
      <Link href="/patients" className="mt-3 rounded-lg bg-brand px-3.5 py-2 font-medium text-brand-ink hover:bg-brand-strong">
        Open patient register
      </Link>
    </div>
  );
}
