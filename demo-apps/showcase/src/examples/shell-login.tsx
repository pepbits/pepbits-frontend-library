import React,{useState} from 'react';
import {Button} from '@pepbits/ui';
import {useSession} from '@pepbits/platform';
import {LoginScreen} from '@pepbits/shell/login';
export function ShellLoginDemo(){const {login}=useSession(),[open,setOpen]=useState(false);return <div className="space-y-3"><p>Preview the public login page against the same controlled demo session. Arbitrary fictional input is ignored; no request is sent. Signing out from the profile menu also opens this login flow.</p><Button onClick={()=>setOpen(value=>!value)}>{open?'Close login preview':'Preview login'}</Button>{open&&<LoginScreen brand={{name:'Showcase',tagline:'Library examples'}} notice="Simulation only. Do not enter real credentials." onSubmit={async(name,password)=>{const error=await login(name,password);if(!error)setOpen(false);return error;}}/>}</div>;}
