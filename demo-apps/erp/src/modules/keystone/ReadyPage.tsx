import type {ReactNode} from 'react';
import {LoadingState,RecoveryNotice,failureFromError} from '@pepbits/components';
import {usePageDefinition} from './api';
import type {PageDef} from './types';
export function ReadyPage({def,children}:{def:PageDef;children:(def:PageDef)=>ReactNode}){const result=usePageDefinition(def);return result.def?children(result.def):result.error?<><p role="alert">{result.error}</p><RecoveryNotice failure={failureFromError(new Error(result.error))} onRetry={result.retry}/></>:<LoadingState title="Loading field values"/>;}
