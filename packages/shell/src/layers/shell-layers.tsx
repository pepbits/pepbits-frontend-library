"use client";
import React from 'react';
import {CommandPalette} from './command-palette';
import {DocumentationDrawer} from './documentation-drawer';
import {HelpAssistant} from './help-assistant';
import {ToastViewport} from './toast-viewport';
/** Mount once; EnterpriseShell includes this composition. */
export function ShellLayers(){return <><CommandPalette/><DocumentationDrawer/><HelpAssistant/><ToastViewport/></>;}
