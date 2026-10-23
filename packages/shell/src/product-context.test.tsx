import React from 'react';
import {fireEvent,render,screen} from '@testing-library/react';
import {expect,test} from 'vitest';
import {ShellTestHost,product} from './test/host';
import {useShell} from './shell-context';
import {Sidebar} from './sidebar';
import {CommandPalette} from './layers';
import {defineProduct} from './products';
import {catalog} from './test/host';

test('unconfigured consumers require an explicit host',()=>{
 function Probe(){return <p>{useShell().product.name}</p>;}
 expect(()=>render(<Probe/>)).toThrow(/ShellProvider/);
});
test('a second host brands the existing sidebar',()=>{
 render(<ShellTestHost brand={{name:'Example Two',tagline:'Team workspace'}} product={{...product,id:'second'}} settings={{preferences:{sidebarPinned:true}}}><Sidebar/></ShellTestHost>);
 expect(screen.getByText('Example Two')).toBeVisible();expect(screen.getByText('Team workspace')).toBeVisible();expect(screen.queryByText('Example')).toBeNull();
});
test('command search cannot offer pages from disabled modules',()=>{
 const limited=defineProduct({navigation:catalog,id:'limited',name:'Limited',tagline:'Workspace',defaultModule:'operations',enabledModules:['operations']});
 function Open(){const shell=useShell();return <button onClick={()=>shell.setCommandOpen(true)}>Search</button>;}
 render(<ShellTestHost product={limited}><Open/><CommandPalette/></ShellTestHost>);fireEvent.click(screen.getByRole('button',{name:'Search'}));
 fireEvent.change(screen.getByPlaceholderText('Search pages, modules and actions…'),{target:{value:'resources'}});
 expect(screen.queryByRole('button',{name:/Resources overview/})).toBeNull();
 fireEvent.change(screen.getByPlaceholderText('Search pages, modules and actions…'),{target:{value:'Items'}});
 expect(screen.getByRole('button',{name:/Items Records/})).toBeVisible();
});
