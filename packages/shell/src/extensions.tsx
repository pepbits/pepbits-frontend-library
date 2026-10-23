'use client';
import React, {createContext, useContext, type ComponentType, type ReactNode} from 'react';

/** Higher layers can extend each document's ScreenHost and the help layer without reverse imports. */
export interface ShellExtensions {
  ScreenHost?: ComponentType<{children?: ReactNode}>;
  helpAssistant?: ReactNode;
}
const Context = createContext<ShellExtensions>({});
export function ShellExtensionsProvider({value,children}: {value: ShellExtensions; children?: ReactNode}) {
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useShellExtensions = () => useContext(Context);
