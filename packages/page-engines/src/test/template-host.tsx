import React from 'react';
import {TestHost} from './render';
import type {PreferenceHostProps} from '@pepbits/preferences/react';
import {PageTemplateWorkspace,type PageTemplateProps} from '../templates/page-template';
export function TemplateUnderTest({preferences={},preferencePolicy,preferencesAvailable,update=()=>{},...props}:PageTemplateProps & Partial<Omit<PreferenceHostProps,'children'>>) {
 return <TestHost preferences={preferences} preferencePolicy={preferencePolicy} preferencesAvailable={preferencesAvailable} update={update}><PageTemplateWorkspace {...props}/></TestHost>;
}
