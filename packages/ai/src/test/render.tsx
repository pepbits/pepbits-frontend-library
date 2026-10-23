import React from 'react';
import {render as renderUI,type RenderOptions} from '@testing-library/react';
import {TestHost} from '@pepbits/patterns/testing';
import {messages} from './messages';
function Host({children}:{children:React.ReactNode}){return <TestHost messages={messages}>{children}</TestHost>;}
export function render(ui:React.ReactNode,options?:RenderOptions){return renderUI(ui,{wrapper:Host,...options});}
