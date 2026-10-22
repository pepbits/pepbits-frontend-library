import React, {type ReactElement, type ReactNode} from 'react';
import {render as testingRender, type RenderOptions} from '@testing-library/react';
import {createTranslator, directionOf} from '@pepbits/i18n';
import {LocalizationProvider} from '@pepbits/i18n/react';
import {PreferenceHost, usePreferences, type PreferenceHostProps} from '@pepbits/preferences/react';
import { PresentationProvider } from '@pepbits/components';
import {ScreenHostProvider, useFormatters, type ScreenHostValue} from '../screen-host';
import {messages} from './messages';

export function TestHost({children, screenHost, ...preferences}: Partial<PreferenceHostProps> & {screenHost?: ScreenHostValue; children?: ReactNode}) {
  return <PreferenceHost preferences={{}} update={() => {}} {...preferences}>
    <LocalizedHost screenHost={screenHost}>{children}</LocalizedHost>
  </PreferenceHost>;
}
function LocalizedHost({children, screenHost}: {children?: ReactNode; screenHost?: ScreenHostValue}) {
  const {preferences} = usePreferences(), format = useFormatters();
  return <LocalizationProvider value={{language: preferences.language, direction: directionOf(preferences.language),
    t: createTranslator({language: preferences.language, catalogs: {en: messages}}), dateTime: format.dateTime}}>
    <PresentationProvider value={preferences}><ScreenHostProvider value={screenHost}>{children}</ScreenHostProvider></PresentationProvider>
  </LocalizationProvider>;
}
export function render(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return testingRender(ui, {wrapper: TestHost, ...options});
}
