import React, {type ReactElement} from 'react';
import {render as testingRender, type RenderOptions} from '@testing-library/react';
import {TestHost} from '@pepbits/patterns/testing';
import type {PreferenceHost} from '../modules/preference-choice';
import {readFileSync} from 'node:fs';
export const sharedMessages = JSON.parse(readFileSync(process.cwd() + "/../../dummy-api/config/localization/shared/en.json", 'utf8')).messages as Record<string, string>;
function wrap(ui: ReactElement) {
  const props = ui.props as Partial<PreferenceHost>;
  return <TestHost messages={sharedMessages} preferences={props.preferences ?? {}} preferencePolicy={props.preferencePolicy}
    preferencesAvailable={props.preferencesAvailable ?? true} update={patch => {for (const [key, value] of Object.entries(patch)) props.onPreferenceChange?.(key as keyof PreferenceHost['preferences'], value);}}>{ui}</TestHost>;
}
export function render(ui: ReactElement, options?: RenderOptions) {
  const result = testingRender(wrap(ui), options);
  return {...result, rerender: (next: ReactElement) => result.rerender(wrap(next))};
}
