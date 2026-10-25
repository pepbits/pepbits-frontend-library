'use client';
import {useNavigation} from '@pepbits/platform/navigation';
import {useScreenHost} from '@pepbits/patterns/screen-host';
import {useLive} from './live';
import {useCaregridFormat} from './format';
import type {Meta} from './types';

export interface ScreenProps {meta: Meta; params: URLSearchParams}
export const failureText = (error: unknown) => error instanceof Error ? error.message : String(error);
/** Services every CareGrid screen uses; writes are gated by the shell product access (UI only, PREF-08). */
export function useScreen() {
  const live = useLive(), format = useCaregridFormat(), navigation = useNavigation(), host = useScreenHost();
  return {...live, f: format, t: format.t, navigation, notify: host.notify, writable: host.can('edit')};
}
