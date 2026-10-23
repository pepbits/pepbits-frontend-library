import React from 'react';
import {Button} from '@pepbits/ui';
/** The controlled demo SessionProvider owns expiry. The shell mounts SessionLock once. */
export function ShellSessionDemo({expireSession}:{expireSession:()=>void}){return <div className="space-y-3"><p>Simulate expiry without discarding the workspace. The shell lock uses the same controlled session as login. Enter arbitrary fictional text to unlock; input is ignored and never transmitted.</p><Button onClick={expireSession}>Lock demo session</Button></div>;}
