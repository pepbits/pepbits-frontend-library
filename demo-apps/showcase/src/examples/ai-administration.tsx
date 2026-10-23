import React from 'react';
import {AiAdministration,useAiHost} from '@pepbits/ai/ui';
export function AiAdministrationDemo(){const {userEnabled}=useAiHost();return userEnabled?<><p>Read-only fictional administration. Usage is illustrative, no provider endpoint or key is configured, and every write is refused by the in-memory port. These displayed limits do not enforce production quotas.</p><AiAdministration/></>:<p>AI is off. Administration is not mounted and its transport is not called.</p>;}
