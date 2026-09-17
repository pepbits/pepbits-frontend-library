"use client";
import {recoveryRequest} from "./recovery";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  initials: string;
  title: string;
  /** A `value` from erp-config's ROLES. The shell shows the matching label;
      it is not selectable -- the role is whatever the account carries. */
  role: string;
  /** A `value` from erp-config's BRANCHES. */
  branch: string;
  /** The account's tenant. Derived server-side and returned with the session;
      the client never asserts it, because a tenant a client can claim is not
      isolation. */
  tenantId: string;
}

export type SessionStatus = "loading" | "anonymous" | "authenticated";

export interface SessionValue {
  status: SessionStatus;
  expired?: boolean;
  user: SessionUser | null;
  /** Resolves to null on success, or the message to show under the form. */
  login: (username: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

const STORAGE_KEY = "nexora-session-token";
const EXPIRED_KEY = "nexora-session-expired";
const INVALIDATED_EVENT = "nexora-session-invalidated";

/* Read once at module scope so both bundlers can statically replace it. Next inlines
   process.env.NEXT_PUBLIC_*; Vite inlines import.meta.env.VITE_*. Neither understands
   the other's form, so each is guarded rather than assumed. */
function apiBase(): string {
  try {
    const vite = (import.meta as unknown as { env?: Record<string, string> }).env;
    if (vite?.VITE_API_URL) return vite.VITE_API_URL;
  } catch {
    // import.meta is unavailable in some CJS interop paths; fall through.
  }
  if (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  return "http://localhost:3200";
}

export const API_BASE = apiBase();
const API = API_BASE;

/**
 * The session token, for callers that cannot go through authedFetch — a
 * WebSocket, whose handshake cannot carry an Authorization header.
 *
 * Exported so no other package has to know the storage key. A second copy of
 * the literal is a rename away from a bug that looks like an auth failure, and
 * that is exactly how it presented the first time.
 */
export function readToken(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    /* Private browsing and some embedded webviews throw on access rather than
       returning null. Treat it as signed out rather than crashing the shell. */
    return null;
  }
}

function writeToken(token: string | null) {
  try {
    if (token === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, token);
  } catch {
    // Storage is unavailable; the session simply will not survive a reload.
  }
}

function expiredMarker(): boolean {try{return !!window.localStorage.getItem(EXPIRED_KEY);}catch{return false;}}
function markExpired(value:boolean) {try{if(value)window.localStorage.setItem(EXPIRED_KEY,String(Date.now()));else window.localStorage.removeItem(EXPIRED_KEY);}catch{}}
const sameIdentity=(a:SessionUser,b:SessionUser)=>['id','tenantId','role','branch'].every(key=>a[key as keyof SessionUser]===b[key as keyof SessionUser]);

/** Locks the current workspace without allowing a stale response to end a newer session. */
export function expireCurrentSession(token:string|null) {
 if(token&&readToken()===token){markExpired(true);writeToken(null);window.dispatchEvent(new Event(INVALIDATED_EVENT));}
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [user, setUser] = useState<SessionUser | null>(null);
  const generation = useRef(0);
  const [expired,setExpired]=useState(false);
  const currentUser=useRef(user);currentUser.current=user;

  /* Invalidate the rendered session before validating a token from another
     window. Request generations prevent late responses from restoring old users. */
  useEffect(() => {
    const validate = async () => {
      const request = ++generation.current;
      const token = readToken();
      setExpired(false);setUser(null);
      setStatus(token ? "loading" : "anonymous");
      if (!token) return;
      const current = () => generation.current === request && readToken() === token;
      try {
        const response = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` }, signal:AbortSignal.timeout(30000) });
        if (!current()) return;
        if (!response.ok) {
          writeToken(null);
          setStatus("anonymous");
          return;
        }
        const body = (await response.json()) as { user: SessionUser };
        if (!current()) return;
        setUser(body.user);
        setStatus("authenticated");
      } catch {
        /* An unreachable API cannot establish that this token is valid. Do not
           guess permissively and strand the user in an unusable signed-in shell. */
        if (current()) { writeToken(null); setStatus("anonymous"); }
      }
    };
    const renewRetained = async () => {
      const retained=currentUser.current,token=readToken(),request=++generation.current;
      setExpired(true);
      if(!retained||!token)return;
      try {
        const response=await fetch(`${API}/auth/me`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(30000)});
        if(generation.current!==request||readToken()!==token)return;
        const body=await response.json().catch(()=>null);
        if(generation.current!==request||readToken()!==token)return;
        if(response.ok&&body?.user&&sameIdentity(retained,body.user)){setUser(body.user);setExpired(false);setStatus('authenticated');}
        else if(response.ok&&body?.user){void validate();}
        else expireCurrentSession(token);
      } catch {/* Keep the old workspace locked until identity can be verified. */}
    };
    const storageChanged = (event: StorageEvent) => {
      if(event.storageArea&&event.storageArea!==window.localStorage)return;
      if(event.key===EXPIRED_KEY&&event.newValue===null&&!readToken()){void validate();return;}
      if(event.key===STORAGE_KEY||event.key===null){
        if(currentUser.current&&!readToken()&&expiredMarker()){generation.current++;setExpired(true);}
        else if(currentUser.current&&readToken())void renewRetained();
        else void validate();
      }
    };
    const invalidated = () => { if(currentUser.current){generation.current++;setExpired(true);}else void validate(); };
    window.addEventListener("storage", storageChanged);
    window.addEventListener(INVALIDATED_EVENT, invalidated);
    void validate();
    return () => {
      generation.current++;
      window.removeEventListener("storage", storageChanged);
      window.removeEventListener(INVALIDATED_EVENT, invalidated);
    };
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<string | null> => {
    const request = ++generation.current;
    let response: Response;
    try {
      response = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        signal: AbortSignal.timeout(30000),
      });
    } catch {
      return "recovery.network";
    }
    if (!response.ok) return response.status===429?'recovery.rate':response.status>=500?'recovery.signInUnavailable':'recovery.signInFailed';
    const body = await response.json().catch(()=>null) as {token:string;user:SessionUser}|null;
    if(!body || typeof body.token!=='string' || !body.token || !body.user || ['id','tenantId','role','branch'].some(key=>typeof body.user[key as keyof SessionUser]!=='string'))return 'recovery.signInUnavailable';
    if (generation.current !== request) return "Sign-in was cancelled. Please try again.";
    if(expired && currentUser.current && !sameIdentity(currentUser.current,body.user)) {
      void fetch(`${API}/auth/logout`,{method:'POST',headers:{Authorization:`Bearer ${body.token}`}}).catch(()=>{});
      return 'recovery.sameUser';
    }
    setExpired(false);
    writeToken(body.token);markExpired(false);
    setUser(body.user);
    setStatus("authenticated");
    return null;
  }, [expired]);

  const logout = useCallback(async () => {
    generation.current++;
    setExpired(false);
    markExpired(false);
    const token = readToken();
    writeToken(null);
    setUser(null);
    setStatus("anonymous");
    if (!token) return;
    // Best effort: the local session is already gone either way.
    try {
      await fetch(`${API}/auth/logout`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    } catch {
      // The demo API being down does not keep the user signed in.
    }
  }, []);

  const value = useMemo<SessionValue>(() => ({ status, user, login, logout, expired }), [login, logout, status, user, expired]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/** Throws when unprovided, for the same reason useNavigation does: a silent fallback
    would render a shell that looks signed in and can do nothing. */
export function useSession(): SessionValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used within a SessionProvider");
  return context;
}

/** fetch with the stored bearer attached. Callers get a plain Response; a 401 means
    the session died server-side (an API restart drops every token) and the caller
    should treat it as signed out rather than retrying. */
export async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = readToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const monitoring=path.startsWith('/monitoring/');
  const response=await recoveryRequest((_path,options)=>fetch(`${API}${path}`,options),path,{...init,headers});
  if (response.status === 401 && !monitoring && token && readToken() === token) {
    expireCurrentSession(token);
  }
  return response;
}

export const DEMO_ACCOUNTS: Array<{ username: string; label: string; role: string }> = [
  { username: "user1", label: "Aisha Rahman", role: "Finance Manager" },
  { username: "user2", label: "Omar Khan", role: "Operations Analyst" },
  { username: "admin", label: "Prakash Mathew", role: "Enterprise Administrator" },
];

/** Host-owned cookie/BFF sessions can reuse consumers without the demo token store. */
export function HostSessionProvider({value,children}:{value:SessionValue;children:React.ReactNode}) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
