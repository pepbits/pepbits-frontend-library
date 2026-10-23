import React, {type ReactElement, type ReactNode} from 'react';
import {render as testingRender, type RenderOptions} from '@testing-library/react';
import {createTranslator, directionOf} from '@pepbits/i18n';
import {LocalizationProvider} from '@pepbits/i18n/react';
import {PreferenceHost, usePreferences, type PreferenceHostProps} from '@pepbits/preferences/react';
import { PresentationProvider } from '@pepbits/components';
import {ScreenHostProvider, useFormatters, type ScreenHostValue} from '../screen-host';
import {NavigationProvider, type NavigationPort} from '@pepbits/platform/navigation';
import {messages} from './messages';

const navigation: NavigationPort = {current:{pageId:"test"},open:()=>{},openInNewContext:()=>{},hrefFor:()=>"#"};

export function TestHost({children, screenHost, messages:extraMessages, ...preferences}: Partial<PreferenceHostProps> & {screenHost?: ScreenHostValue; messages?: Record<string,string>; children?: ReactNode}) {
  return <PreferenceHost preferences={{}} update={() => {}} {...preferences}>
    <LocalizedHost screenHost={screenHost} extraMessages={extraMessages}>{children}</LocalizedHost>
  </PreferenceHost>;
}
function LocalizedHost({children, screenHost, extraMessages}: {children?: ReactNode; screenHost?: ScreenHostValue;extraMessages?:Record<string,string>}) {
  const {preferences} = usePreferences(), format = useFormatters();
  return <LocalizationProvider value={{language: preferences.language, direction: directionOf(preferences.language),
    t: createTranslator({language: preferences.language, catalogs: {en: {...messages,...extraMessages}}}), dateTime: format.dateTime}}>
    <PresentationProvider value={preferences}><ScreenHostProvider value={screenHost}><NavigationProvider value={navigation}>{children}</NavigationProvider></ScreenHostProvider></PresentationProvider>
  </LocalizationProvider>;
}
export function render(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return testingRender(ui, {wrapper: TestHost, ...options});
}
