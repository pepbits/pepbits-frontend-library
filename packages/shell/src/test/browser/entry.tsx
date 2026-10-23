import React from 'react';
import {createRoot} from 'react-dom/client';
import {EnterpriseShell} from '../../enterprise-shell';
import {ShellTestHost} from '../host';
import './style.css';
const sidebarPlacement=new URLSearchParams(location.search).get('side')==='right'?'right':'left';
createRoot(document.getElementById('root')!).render(<ShellTestHost settings={{preferences:{language:'ar',sidebarPlacement,sidebarPinned:false,sidebarExpandOn:'click',sidebarFocusExpand:true,reducedMotion:true}}}>
  <EnterpriseShell header={<button data-outside>خارج القائمة</button>} footer={null}><p>محتوى مساحة العمل</p></EnterpriseShell>
</ShellTestHost>);
