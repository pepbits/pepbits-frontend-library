import React from 'react';
import {usePreferences} from '@pepbits/preferences/react';
import {ReferenceSchoolModule as Module} from '../module';
import type {ReferenceModuleProps} from '../host';
import {TestProviders} from './providers';
export {SCHOOL_ROUTES} from '../routes';
export function ReferenceSchoolModule(props:ReferenceModuleProps){return <TestProviders host={props.host}><Module {...props}/></TestProviders>;}
