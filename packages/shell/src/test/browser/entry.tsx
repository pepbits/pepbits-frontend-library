import React from 'react';
import {createRoot} from 'react-dom/client';
import {useERP} from '../../shell-context';
import type {ThemeKey} from '@pepbits/preferences';
import {Avatar} from '@pepbits/ui';
import {EnterpriseShell} from '../../enterprise-shell';
import {ShellTestHost} from '../host';
import './style.css';
function ToastActions(){const {toast}=useERP();return <button onClick={()=>{for(const type of ['success','error','warning','info'] as const)toast({title:type+' notification',message:'Readable notification detail',type});}}>Show notifications</button>;}
const theme=(new URLSearchParams(location.search).get('theme')??'nexora') as ThemeKey;
const showToasts=new URLSearchParams(location.search).has('toasts');
const showAvatars=new URLSearchParams(location.search).has('avatars');
const sidebarPlacement=new URLSearchParams(location.search).get('side')==='right'?'right':'left';
createRoot(document.getElementById('root')!).render(<ShellTestHost settings={{preferences:{theme,toastStyle:'solid',toastDuration:8000,maxVisibleToasts:5,language:'ar',sidebarPlacement,sidebarPinned:false,sidebarExpandOn:'click',sidebarFocusExpand:true,reducedMotion:true}}}>
  <EnterpriseShell header={<button data-outside>خارج القائمة</button>} footer={null}>{showToasts?<ToastActions/>:showAvatars?<div>{['--bg','--surface','--surface-2','--surface-3'].map(token=><div key={token} data-avatar-surface={token} style={{background:`var(${token})`}}><Avatar name="D"/></div>)}</div>:<p>محتوى مساحة العمل</p>}</EnterpriseShell>
</ShellTestHost>);
