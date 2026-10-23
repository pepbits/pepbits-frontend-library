import React from 'react';
import {render as testingRender,type RenderOptions} from '@testing-library/react';
import {TestHost as PatternsTestHost} from '@pepbits/patterns/testing';
import {messages} from './messages';
export function TestHost(props:React.ComponentProps<typeof PatternsTestHost>){return <PatternsTestHost messages={messages} {...props}/>;}
export function render(ui:React.ReactElement,options?:Omit<RenderOptions,'wrapper'>){return testingRender(ui,{wrapper:TestHost,...options});}
