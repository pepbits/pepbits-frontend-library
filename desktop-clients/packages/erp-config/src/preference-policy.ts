import {DEFAULT_PREFERENCES,sanitizePreferences} from './preference-defaults.ts';
import type {UserPreferences} from './types.ts';
export type PreferenceKey = keyof UserPreferences;
export type PreferenceRule = {value:UserPreferences[PreferenceKey];locked:boolean;allowedValues?:Array<UserPreferences[PreferenceKey]>};
export interface PreferencePolicy {revision:number;rules:Partial<Record<PreferenceKey,PreferenceRule>>}
export const EMPTY_PREFERENCE_POLICY:PreferencePolicy={revision:0,rules:{}};
export function validPreference(key:string,value:unknown):key is PreferenceKey {
  return Object.hasOwn(DEFAULT_PREFERENCES,key) && sanitizePreferences({[key]:value})[key as PreferenceKey]===value;
}
export function parsePreferencePolicy(value:unknown):PreferencePolicy {
  if(!value || typeof value!=='object')throw new Error('Invalid preference policy.');
  const policy=value as PreferencePolicy;
  if(!Number.isSafeInteger(policy.revision)||policy.revision<0||!policy.rules||typeof policy.rules!=='object'||Array.isArray(policy.rules))throw new Error('Invalid preference policy.');
  const rules:PreferencePolicy['rules']={};
  for(const [key,rule] of Object.entries(policy.rules)) {
    if(!rule||typeof rule!=='object'||typeof rule.locked!=='boolean'||!validPreference(key,rule.value)||Object.keys(rule).some(key=>!['value','locked','allowedValues'].includes(key)))throw new Error('Invalid preference policy.');
    if(rule.allowedValues!==undefined&&(!Array.isArray(rule.allowedValues)||!rule.allowedValues.length||rule.allowedValues.length>100||rule.allowedValues.some(v=>!validPreference(key,v))||!rule.allowedValues.includes(rule.value)))throw new Error("Invalid allowed preference values.");
    rules[key]={value:rule.value,locked:rule.locked,...(rule.allowedValues?{allowedValues:rule.allowedValues}:{})};
  }
  return {revision:policy.revision,rules};
}
export function policyDefaults(policy:PreferencePolicy):UserPreferences {
  return sanitizePreferences({...DEFAULT_PREFERENCES,...Object.fromEntries(Object.entries(policy.rules).map(([key,rule])=>[key,rule!.value]))});
}
export function effectivePreferences(overrides:Partial<UserPreferences>,policy:PreferencePolicy):UserPreferences {
  const locks=Object.fromEntries(Object.entries(policy.rules).filter(([,rule])=>rule?.locked).map(([key,rule])=>[key,rule!.value]));
  return sanitizePreferences({...policyDefaults(policy),...Object.fromEntries(Object.entries(overrides).filter(([key,value])=>!policy.rules[key as PreferenceKey]?.allowedValues||policy.rules[key as PreferenceKey]!.allowedValues!.includes(value))),...locks});
}
export function editablePreferenceOverrides(values:UserPreferences,policy:PreferencePolicy):Partial<UserPreferences> {
  const defaults=policyDefaults(policy);
  return Object.fromEntries(Object.entries(values).filter(([key,value])=>!policy.rules[key as PreferenceKey]?.locked && (!policy.rules[key as PreferenceKey]?.allowedValues||policy.rules[key as PreferenceKey]!.allowedValues!.includes(value)) && defaults[key as PreferenceKey]!==value));
}
