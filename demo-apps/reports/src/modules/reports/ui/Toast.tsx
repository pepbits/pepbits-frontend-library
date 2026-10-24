"use client";
/*
 * Port of lumen-reports src/components/ui/Toast.tsx onto the shared host notifications. The application shell
 * owns the toast viewport, so position, duration, style and visible count follow the effective toast
 * preferences there; the module keeps the source useToast() call shape.
 */
import React, { useMemo } from 'react';
import { useScreenHost } from '@pepbits/patterns/screen-host';
import { useLocalization } from '@pepbits/i18n/react';

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useToast() {
  const { notify } = useScreenHost();
  const { t } = useLocalization();
  return useMemo(() => ({
    success: (m: string) => notify(t(m), { tone: 'success' }),
    error: (m: unknown) => notify(m instanceof Error ? m.message : t(String(m)), { tone: 'error' }),
    info: (m: string) => notify(t(m), { tone: 'info' }),
  }), [notify, t]);
}
