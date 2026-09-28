'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Ctx = { title: string | null; setTitle: (t: string | null) => void };
const PageTitle = createContext<Ctx>({ title: null, setTitle: () => {} });

export function PageTitleProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState<string | null>(null);
  return <PageTitle.Provider value={{ title, setTitle }}>{children}</PageTitle.Provider>;
}
export const usePageTitleValue = () => useContext(PageTitle).title;

/** Record pages call this so the header shows the record name instead of the list title. */
export function usePageTitle(title: string | null | undefined) {
  const { setTitle } = useContext(PageTitle);
  useEffect(() => { if (title) setTitle(title); }, [title, setTitle]);
  useEffect(() => () => setTitle(null), [setTitle]);
}
