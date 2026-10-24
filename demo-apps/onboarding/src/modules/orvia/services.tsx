'use client';
import React, {createContext, useContext, type AnchorHTMLAttributes, type ReactNode} from 'react';
import {useNavigation} from '@pepbits/platform/navigation';
import type {OnboardingPort} from '../../adapters/onboarding';
import {onboardingTarget, type OnboardingKind, type OnboardingTarget} from '../../navigation';

const Services = createContext<OnboardingPort | null>(null);
export function OnboardingServices({value, children}: {value: OnboardingPort; children: ReactNode}) {return <Services.Provider value={value}>{children}</Services.Provider>;}
export function useOnboarding(): OnboardingPort {
  const value = useContext(Services);
  if (!value) throw new Error('Onboarding services are missing');
  return value;
}
/** Read the current target's query string (deep-link parameters such as `ws`, `type`, `structure`). */
export function useTargetParams(): URLSearchParams {
  const {current} = useNavigation();
  const query = (current as OnboardingTarget).query ?? '';
  return React.useMemo(() => new URLSearchParams(query), [query]);
}
export function useOpen() {
  const navigation = useNavigation();
  return (pageId: OnboardingKind, params?: Record<string, string | undefined>) => navigation.open(onboardingTarget(pageId, params));
}
/** In-app anchor: a real href for new-tab/copy, host navigation for ordinary activation. */
export function OrviaLink({to, params, children, onClick, ...props}: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {to: OnboardingKind; params?: Record<string, string | undefined>}) {
  const navigation = useNavigation(), target = onboardingTarget(to, params);
  return <a {...props} href={navigation.hrefFor(target)} onClick={event => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); navigation.open(target);
  }}>{children}</a>;
}
