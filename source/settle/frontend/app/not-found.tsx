import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-[15px] font-medium">This page doesn’t exist.</p>
      <Link href="/" className="text-[14px] font-medium text-pine-700 hover:underline">Go to the desk</Link>
    </div>
  );
}
