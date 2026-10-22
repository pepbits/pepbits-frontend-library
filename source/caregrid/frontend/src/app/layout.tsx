import type { Metadata, Viewport } from 'next';
import './globals.css';
import { LiveProvider } from '@/lib/live';
import { AppShell } from '@/components/shell/AppShell';

export const metadata: Metadata = {
  title: 'CareGrid: clinical scheduling and resource planning',
  description: 'Appointments, slots, resources, availability and exceptions across hospital, clinics, pharmacy and home care.',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0F2E35' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <LiveProvider>
          <AppShell>{children}</AppShell>
        </LiveProvider>
      </body>
    </html>
  );
}
