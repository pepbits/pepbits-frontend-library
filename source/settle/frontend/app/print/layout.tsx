export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-mist-2 py-6 print:bg-white print:py-0">{children}</div>;
}
