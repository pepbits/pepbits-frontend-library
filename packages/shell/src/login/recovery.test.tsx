import {render} from "../test/render";
import React from 'react';
import {screen,fireEvent} from '@testing-library/react';
import {test,expect,vi} from 'vitest';
import {LoginScreen} from './index';
test('anonymous sign-in uses readable fallback copy before account localization is loaded',async()=>{
 const submit=vi.fn().mockResolvedValue('recovery.signInFailed');render(<LoginScreen brand={{name:"Example",tagline:"Workspace"}} onSubmit={submit}/>);
 fireEvent.change(screen.getByPlaceholderText('user1'),{target:{value:'user1'}});fireEvent.change(document.querySelector('input[type=password]')!,{target:{value:'wrong'}});
 fireEvent.click(screen.getByRole('button',{name:/Sign in/i}));expect(await screen.findByRole('alert')).toHaveTextContent('Sign-in failed. Check your username and password.');expect(screen.getByRole('alert')).not.toHaveTextContent('recovery.');
});
