import React from 'react';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import {HostSessionProvider} from '@pepbits/platform';
import {TestHost} from '@pepbits/patterns/testing';
import {LoginScreen,SessionSplash,ShellSkeleton} from './index';
import {session} from '../test/host';
import {preferenceMessages} from '../test/preference-messages';
function mount(login:ReturnType<typeof vi.fn>){return render(<HostSessionProvider value={{...session,status:'anonymous',user:null,login}}><TestHost messages={preferenceMessages}><LoginScreen brand={{name:'Example Workspace',accentName:'Portal',tagline:'Work together'}} notice="Host environment"/></TestHost></HostSessionProvider>);}
test('host branding and platform session drive login without demo account fixtures',async()=>{
 const login=vi.fn().mockResolvedValue('Try again');mount(login);
 expect(screen.getAllByText(/Example Workspace/)).toHaveLength(2);expect(screen.getByText('Host environment')).toBeVisible();expect(screen.queryByText('Demo accounts')).toBeNull();
 fireEvent.change(screen.getByLabelText(/Username/),{target:{value:'  person  '}});fireEvent.change(screen.getByLabelText(/Password/),{target:{value:'test-input'}});
 fireEvent.submit(screen.getByLabelText(/Password/).closest('form')!);
 await waitFor(()=>expect(login).toHaveBeenCalledWith('person','test-input'));expect(await screen.findByRole('alert')).toHaveTextContent('Try again');expect(screen.getByRole('button',{name:'Sign in'})).toBeEnabled();
});
test('busy sign-in cannot be submitted twice and preserves input on failure',async()=>{
 let resolve!:(message:string)=>void;const login=vi.fn(()=>new Promise<string>(done=>{resolve=done;}));mount(login);
 fireEvent.change(screen.getByLabelText(/Username/),{target:{value:'person'}});fireEvent.change(screen.getByLabelText(/Password/),{target:{value:'test-input'}});
 const form=screen.getByLabelText(/Password/).closest('form')!;fireEvent.submit(form);fireEvent.submit(form);expect(login).toHaveBeenCalledOnce();resolve('Unavailable');
 expect(await screen.findByRole('alert')).toHaveTextContent('Unavailable');expect(screen.getByLabelText(/Username/)).toHaveValue('person');
});
test('session loading screens remain available before shell mount',()=>{
 render(<TestHost messages={preferenceMessages}><SessionSplash/><ShellSkeleton/></TestHost>);expect(screen.getByText('Restoring your session…')).toBeVisible();
});
