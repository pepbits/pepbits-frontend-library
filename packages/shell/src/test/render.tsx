import React from 'react';
import {render as renderUI, type RenderOptions} from '@testing-library/react';
import {ShellTestHost} from './host';
export function render(ui: React.ReactNode,options?:RenderOptions){return renderUI(ui,{wrapper:ShellTestHost,...options});}
