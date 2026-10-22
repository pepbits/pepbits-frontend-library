import type { Metadata } from 'next';
import { LayoutSetup } from '@/components/settings/LayoutSetup';

export const metadata: Metadata = { title: 'Form layout' };

export default function LayoutSettingsPage() {
  return <LayoutSetup />;
}
