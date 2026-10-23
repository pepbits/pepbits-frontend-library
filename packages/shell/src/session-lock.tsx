"use client";
import React,{useEffect,useRef,useState} from 'react';
import {useSession} from '@pepbits/platform';
import {Button, Input} from "@pepbits/ui";
import {useLocalization} from "@pepbits/i18n/react";
/** The native modal top layer makes every background portal inert as well. */
export function SessionLock({children}:{children:React.ReactNode}){
 const {expired,login,logout}=useSession(),{t}=useLocalization();
 const dialog=useRef<HTMLDialogElement>(null);
 const [username,setUsername]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{if(expired)dialog.current?.showModal();else {dialog.current?.close();setPassword('');setError('');}},[expired]);
 return <>{children}{expired?<dialog ref={dialog} onCancel={event=>event.preventDefault()} onKeyDown={event=>event.stopPropagation()} className="fixed inset-0 m-auto w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-[var(--text)] backdrop:bg-[var(--bg)]" aria-label={t('Your session has ended')}>
  <form className="space-y-4" onSubmit={async event=>{event.preventDefault();if(busy)return;setBusy(true);setError('');try{const message=await login(username.trim(),password);if(message)setError(message);}finally{setBusy(false);setPassword('');}}}>
   <h1 className="text-xl font-semibold">{t('Your session has ended')}</h1><p>{t('recovery.session')}</p>
   <Input label={t('Username')} autoComplete="username" value={username} onChange={event=>setUsername(event.target.value)} required />
   <Input label={t('Password')} type="password" autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)} required />
   {error?<p role="alert">{t(error)}</p>:null}
   <Button type="submit" disabled={busy}>{t('Sign in')}</Button>
   <Button disabled={busy} onClick={()=>{if(window.confirm(t('recovery.discardConfirm')))void logout();}}>{t('recovery.discardSignOut')}</Button>
  </form>
 </dialog>:null}</>;
}
