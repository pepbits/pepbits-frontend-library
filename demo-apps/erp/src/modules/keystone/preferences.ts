import {usePreferences} from '@pepbits/preferences/react';
import type {PreferenceKey,UserPreferences} from '@pepbits/preferences';
export function useManagedPreference<K extends PreferenceKey>(key:K){const host=usePreferences(),value=host.preferences[key],disabled=host.isLocked(key),allowed=host.allowedValues(key);return {value,disabled,set:(next:UserPreferences[K])=>{if(disabled||allowed&&!allowed.includes(next))return false;void host.update({[key]:next});return true;}};}
