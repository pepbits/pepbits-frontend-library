import React from "react";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { HostSessionProvider, SessionProvider, createAuthedFetch, readToken, useSession } from "./session.tsx";

/**
 * The session.
 *
 * Two things here are worth more than the plumbing. A stored token is
 * REVALIDATED rather than trusted, because trusting it renders a signed-in
 * shell whose every request then 401s — which looks like a broken application
 * rather than an expired session. And every failure resolves towards signed
 * OUT: the API being down is indistinguishable from a bad token, and guessing
 * permissively strands the user in a shell that cannot do anything.
 */

const API_BASE = "/host-api";
const authedFetch = (path: string, init?: RequestInit) => createAuthedFetch({apiBaseUrl: API_BASE, fetch: fetchMock})(path, init);

const STORAGE_KEY = "pepbits-session-token";

const user = {
  id: "u1",
  name: "Sample User",
  email: "user@example.test",
  initials: "SU",
  title: "Member",
  role: "member",
  branch: "branch-a",
  tenantId: "t1",
};

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

/* A failed thenable rather than a rejected promise: vitest reports a rejection
   raised inside a mock as an unhandled error against whichever test happens to
   be running when it surfaces. Nothing here ever rejects, and the code under
   test still takes its catch branch. */
const offline = () => ({
  then: (_resolve: unknown, reject: (error: unknown) => void) => reject(new TypeError("Failed to fetch")),
});

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function Probe() {
  const session = useSession();
  return (
    <div>
      <output data-testid="expired">{String(session.expired)}</output>
      <output data-testid="status">{session.status}</output>
      <output data-testid="user">{session.user?.name ?? "-"}</output>
      <button onClick={() => void session.login("user1", "pw")}>sign in</button>
      <button onClick={() => void session.logout()}>sign out</button>
    </div>
  );
}

const mount = () => render(<SessionProvider apiBaseUrl={API_BASE}><Probe /></SessionProvider>);
const status = () => screen.getByTestId("status").textContent;
const click = async (label: string) => {
  await act(async () => {
    screen.getByText(label).click();
  });
};

describe("the stored token", () => {
  test("no token means anonymous, and nothing is asked of the API", async () => {
    mount();
    await waitFor(() => expect(status()).toBe("anonymous"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  /* Revalidated, not trusted. */
  test("a stored token is checked against the API before anything renders signed in", async () => {
    window.localStorage.setItem(STORAGE_KEY, "tok-1");
    fetchMock.mockResolvedValue(json(200, { user }));
    mount();
    await waitFor(() => expect(status()).toBe("authenticated"));
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${API_BASE}/auth/me`);
    expect(init.headers.Authorization).toBe("Bearer tok-1");
    expect(screen.getByTestId("user").textContent).toBe("Sample User");
  });

  test("a token the API rejects is thrown away, not kept for the next reload", async () => {
    window.localStorage.setItem(STORAGE_KEY, "stale");
    fetchMock.mockResolvedValue(json(401, {}));
    mount();
    await waitFor(() => expect(status()).toBe("anonymous"));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  /* The API being down is indistinguishable from a bad token. Guessing
     permissively would render a signed-in shell that can do nothing. */
  test("an unreachable API also signs the user out", async () => {
    window.localStorage.setItem(STORAGE_KEY, "tok-1");
    fetchMock.mockImplementation(() => offline() as unknown as Promise<Response>);
    mount();
    await waitFor(() => expect(status()).toBe("anonymous"));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  test("nothing is claimed while the check is still in flight", async () => {
    window.localStorage.setItem(STORAGE_KEY, "tok-1");
    let settle: (response: Response) => void = () => {};
    fetchMock.mockReturnValue(new Promise<Response>((resolve) => { settle = resolve; }));
    mount();
    expect(status()).toBe("loading");
    await act(async () => { settle(json(200, { user })); });
    await waitFor(() => expect(status()).toBe("authenticated"));
  });
});

describe("signing in", () => {
  test("stores the token and the user the server returned", async () => {
    fetchMock.mockResolvedValue(json(200, { token: "tok-new", user }));
    mount();
    await waitFor(() => expect(status()).toBe("anonymous"));
    await click("sign in");
    await waitFor(() => expect(status()).toBe("authenticated"));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("tok-new");
    expect(screen.getByTestId("user").textContent).toBe("Sample User");
  });

  test("posts the credentials as JSON and nothing else", async () => {
    fetchMock.mockResolvedValue(json(200, { token: "tok-new", user }));
    mount();
    await waitFor(() => expect(status()).toBe("anonymous"));
    await click("sign in");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${API_BASE}/auth/login`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ username: "user1", password: "pw" });
  });

  /* The tenant is derived server-side and returned with the session. A tenant a
     client can claim is not isolation, so nothing here sends one. */
  test("does not send a tenant", async () => {
    fetchMock.mockResolvedValue(json(200, { token: "tok-new", user }));
    mount();
    await waitFor(() => expect(status()).toBe("anonymous"));
    await click("sign in");
    expect(fetchMock.mock.calls[0]![1].body).not.toContain("tenant");
  });

  test("a refused sign-in leaves the session anonymous and stores no token", async () => {
    fetchMock.mockResolvedValue(json(401, { error: "Wrong password." }));
    mount();
    await waitFor(() => expect(status()).toBe("anonymous"));
    await click("sign in");
    expect(status()).toBe("anonymous");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe("signing out", () => {
  const signedIn = async () => {
    window.localStorage.setItem(STORAGE_KEY, "tok-1");
    fetchMock.mockResolvedValue(json(200, { user }));
    mount();
    await waitFor(() => expect(status()).toBe("authenticated"));
    fetchMock.mockClear();
  };

  test("clears the token and the user", async () => {
    await signedIn();
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await click("sign out");
    expect(status()).toBe("anonymous");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(screen.getByTestId("user").textContent).toBe("-");
  });

  test("tells the server, carrying the token being retired", async () => {
    await signedIn();
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await click("sign out");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${API_BASE}/auth/logout`);
    expect(init.headers.Authorization).toBe("Bearer tok-1");
  });

  /* Local first, server second. The demo API being down does not keep someone
     signed in on a machine they are walking away from. */
  test("an unreachable server does not keep the user signed in", async () => {
    await signedIn();
    fetchMock.mockImplementation(() => offline() as unknown as Promise<Response>);
    await click("sign out");
    expect(status()).toBe("anonymous");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe("readToken", () => {
  test("reads what was stored, without the caller knowing the key", () => {
    window.localStorage.setItem(STORAGE_KEY, "tok-1");
    expect(readToken()).toBe("tok-1");
  });

  /* Private browsing and some embedded webviews throw on access rather than
     returning null. That is signed out, not a crashed shell. */
  test("storage that throws reads as signed out", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    expect(readToken()).toBeNull();
  });

  test("a shell whose storage cannot be written still signs in", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    fetchMock.mockResolvedValue(json(200, { token: "tok-new", user }));
    mount();
    await waitFor(() => expect(status()).toBe("anonymous"));
    await click("sign in");
    /* The session simply will not survive a reload. */
    expect(status()).toBe("authenticated");
  });
});

describe("authedFetch", () => {
  test("attaches the stored bearer and prefixes the API", async () => {
    window.localStorage.setItem(STORAGE_KEY, "tok-1");
    fetchMock.mockResolvedValue(json(200, {}));
    await authedFetch("/settings");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${API_BASE}/settings`);
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer tok-1");
  });

  test("sends no Authorization header when there is no token", async () => {
    fetchMock.mockResolvedValue(json(200, {}));
    await authedFetch("/settings");
    expect(new Headers(fetchMock.mock.calls[0]![1].headers).get("Authorization")).toBeNull();
  });

  test("keeps the caller's own headers and method", async () => {
    window.localStorage.setItem(STORAGE_KEY, "tok-1");
    fetchMock.mockResolvedValue(json(200, {}));
    await authedFetch("/commands", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.method).toBe("POST");
    const headers = new Headers(init.headers);
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("Authorization")).toBe("Bearer tok-1");
  });

  /* A plain Response, not a thrown error: a 401 means the session died
     server-side (an API restart drops every token) and the caller decides. */
  test("hands back the response rather than interpreting it", async () => {
    fetchMock.mockResolvedValue(json(401, {}));
    expect((await authedFetch("/settings")).status).toBe(401);
  });
});

describe("useSession", () => {
  /* A silent fallback would render a shell that looks signed in and can do
     nothing, which is harder to diagnose than a thrown error at the boundary. */
  test("throws outside a provider rather than inventing an empty session", () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/SessionProvider/);
    quiet.mockRestore();
  });
});

describe("session invalidation across windows", () => {
  test("logout in another window removes the rendered session", async () => {
    localStorage.setItem(STORAGE_KEY, "tok-1");
    fetchMock.mockResolvedValue(json(200, { user }));
    mount(); await waitFor(() => expect(status()).toBe("authenticated"));
    await act(async () => {
      localStorage.removeItem(STORAGE_KEY);
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, oldValue: "tok-1", newValue: null }));
    });
    expect(status()).toBe("anonymous");
    expect(screen.getByTestId("user")).toHaveTextContent("-");
  });
  test("an in-flight validation cannot sign back in after another window logs out", async () => {
    localStorage.setItem(STORAGE_KEY, "tok-1");
    let resolve!: (response: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>(r => { resolve = r; }));
    mount();
    await act(async () => {
      localStorage.removeItem(STORAGE_KEY);
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
      resolve(json(200, { user }));
    });
    expect(status()).toBe("anonymous");
  });
  test("a 401 invalidates the current session in this window", async () => {
    localStorage.setItem(STORAGE_KEY, "tok-1");
    fetchMock.mockResolvedValueOnce(json(200, { user })).mockResolvedValueOnce(json(401, {}));
    mount(); await waitFor(() => expect(status()).toBe("authenticated"));
    await act(async () => { await authedFetch("/records"); });
    expect(status()).toBe("authenticated");
    expect(screen.getByTestId("expired")).toHaveTextContent("true");
    expect(readToken()).toBeNull();
  });
  test("a monitoring 401 cannot sign out an otherwise authenticated user", async () => {
    localStorage.setItem(STORAGE_KEY, "tok-1");
    fetchMock.mockResolvedValueOnce(json(200, { user })).mockResolvedValueOnce(json(401, {}));
    mount(); await waitFor(() => expect(status()).toBe("authenticated"));
    await act(async () => { await authedFetch("/monitoring/events", {method:"POST"}); });
    expect(status()).toBe("authenticated");expect(readToken()).toBe("tok-1");
  });
  test("a stale 401 cannot remove a newer token", async () => {
    localStorage.setItem(STORAGE_KEY, "old");
    let resolve!: (response: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>(r => { resolve = r; }));
    const response = authedFetch("/records");
    localStorage.setItem(STORAGE_KEY, "new");
    resolve(json(401, {}));
    await response;
    expect(readToken()).toBe("new");
  });
});

test("a pending sign-in cannot undo logout", async () => {
  let resolve!: (response: Response) => void;
  fetchMock.mockReturnValue(new Promise<Response>(r => { resolve = r; }));
  mount();
  await click("sign in");
  await click("sign out");
  await act(async () => { resolve(json(200, { token: "late", user })); });
  expect(status()).toBe("anonymous");
  expect(readToken()).toBeNull();
});

test('same-user reauthentication keeps the retained session; a different identity cannot unlock it',async()=>{
 localStorage.setItem(STORAGE_KEY,'tok-1');fetchMock.mockResolvedValueOnce(json(200,{user}));mount();await waitFor(()=>expect(status()).toBe('authenticated'));
 fetchMock.mockResolvedValueOnce(json(401,{}));await act(async()=>{await authedFetch('/records');});expect(screen.getByTestId('expired')).toHaveTextContent('true');
 fetchMock.mockResolvedValueOnce(json(200,{token:'foreign',user:{...user,id:'other'}})).mockResolvedValueOnce(json(200,{}));
 fireEvent.click(screen.getByText('sign in'));await waitFor(()=>expect(fetchMock).toHaveBeenCalledTimes(4));expect(readToken()).toBeNull();expect(screen.getByTestId('expired')).toHaveTextContent('true');
 fetchMock.mockResolvedValueOnce(json(200,{token:'renewed',user}));fireEvent.click(screen.getByText('sign in'));await waitFor(()=>expect(readToken()).toBe('renewed'));expect(screen.getByTestId('expired')).toHaveTextContent('false');
});

test('another window can expire and renew the same identity without discarding this workspace',async()=>{
 localStorage.setItem(STORAGE_KEY,'one');fetchMock.mockResolvedValueOnce(json(200,{user}));mount();await waitFor(()=>expect(status()).toBe('authenticated'));
 localStorage.setItem('pepbits-session-expired','1');localStorage.removeItem(STORAGE_KEY);
 await act(async()=>window.dispatchEvent(new StorageEvent('storage',{key:STORAGE_KEY,newValue:null})));expect(status()).toBe('authenticated');expect(screen.getByTestId('expired')).toHaveTextContent('true');
 fetchMock.mockResolvedValueOnce(json(200,{user}));localStorage.setItem(STORAGE_KEY,'renewed');localStorage.removeItem('pepbits-session-expired');
 await act(async()=>window.dispatchEvent(new StorageEvent('storage',{key:STORAGE_KEY,newValue:'renewed'})));await waitFor(()=>expect(screen.getByTestId('expired')).toHaveTextContent('false'));expect(status()).toBe('authenticated');
});

test('a late cross-window identity body cannot reopen the session after logout',async()=>{
 localStorage.setItem(STORAGE_KEY,'one');fetchMock.mockResolvedValueOnce(json(200,{user}));mount();await waitFor(()=>expect(status()).toBe('authenticated'));
 let finish!:(body:unknown)=>void;const body=new Promise(resolve=>{finish=resolve;});fetchMock.mockResolvedValueOnce({ok:true,json:()=>body});localStorage.setItem(STORAGE_KEY,'two');
 await act(async()=>window.dispatchEvent(new StorageEvent('storage',{key:STORAGE_KEY,newValue:'two'})));expect(screen.getByTestId('expired')).toHaveTextContent('true');
 localStorage.removeItem(STORAGE_KEY);await act(async()=>window.dispatchEvent(new StorageEvent('storage',{key:STORAGE_KEY,newValue:null})));expect(status()).toBe('anonymous');
 await act(async()=>{finish({user});await body;});expect(status()).toBe('anonymous');expect(screen.getByTestId('user')).toHaveTextContent('-');expect(readToken()).toBeNull();
});


test("host-owned sessions use the verified host value without demo fetches or token persistence", async () => {
 const logout=vi.fn(async()=>{}),login=vi.fn(async()=>null);
 const {rerender}=render(<HostSessionProvider value={{status:'authenticated',user,login,logout}}><Probe/></HostSessionProvider>);
 expect(screen.getByTestId('user')).toHaveTextContent(user.name);
 expect(fetchMock).not.toHaveBeenCalled();expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'sign out'}));expect(logout).toHaveBeenCalledOnce();
 rerender(<HostSessionProvider value={{status:'anonymous',user:null,login,logout}}><Probe/></HostSessionProvider>);
 expect(screen.getByTestId('user')).toHaveTextContent('-');expect(fetchMock).not.toHaveBeenCalled();
});

test('host fetch and base URL configure provider and authenticated adapters without global network', async () => {
  const send = vi.fn(async (_path: string, _init?: RequestInit) => json(200, {token: 'host-token', user}));
  render(<SessionProvider apiBaseUrl="/custom-api" fetch={send}><Probe /></SessionProvider>);
  await click('sign in');
  await waitFor(() => expect(status()).toBe('authenticated'));
  expect(send.mock.calls[0]![0]).toBe('/custom-api/auth/login');
  expect(send.mock.calls[0]![1]!.signal).toBeInstanceOf(AbortSignal);
  await createAuthedFetch({apiBaseUrl: '/custom-api', fetch: send})('/records');
  expect(send.mock.calls[1]![0]).toBe('/custom-api/records');
  await click('sign out');
  expect(send.mock.calls[2]![0]).toBe('/custom-api/auth/logout');
  expect(fetchMock).not.toHaveBeenCalled();
});

test('an explicitly empty API base uses same-origin paths and clients keep separate configuration', async () => {
  const send = vi.fn(async (_path: string, _init?: RequestInit) => json(200, {}));
  const first = createAuthedFetch({apiBaseUrl: '', fetch: send});
  const second = createAuthedFetch({apiBaseUrl: '/other', fetch: send});
  await first('/settings'); await second('/settings'); await first('/settings');
  expect(send.mock.calls.map(([path]) => path)).toEqual(['/settings', '/other/settings', '/settings']);
});

test('changing provider transport invalidates an earlier validation response', async () => {
  localStorage.setItem(STORAGE_KEY, 'stored');
  let finish!: (response: Response) => void;
  const old = vi.fn(() => new Promise<Response>(resolve => { finish = resolve; }));
  const current = vi.fn(async () => json(200, {user: {...user, name: 'Current User'}}));
  const {rerender} = render(<SessionProvider apiBaseUrl="/old" fetch={old}><Probe /></SessionProvider>);
  rerender(<SessionProvider apiBaseUrl="/current" fetch={current}><Probe /></SessionProvider>);
  await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('Current User'));
  await act(async () => finish(json(200, {user})));
  expect(screen.getByTestId('user')).toHaveTextContent('Current User');
});

test('controlled SessionProvider uses host snapshots without token or network access',()=>{
 const login=vi.fn(async()=>null),logout=vi.fn(async()=>{});
 function Read(){const session=useSession();return <span>{session.status}:{session.user?.name??'none'}</span>;}
 const {rerender}=render(<SessionProvider value={{status:'authenticated',user,login,logout}}><Read/></SessionProvider>);
 expect(screen.getByText('authenticated:Sample User')).toBeVisible();expect(fetchMock).not.toHaveBeenCalled();expect(readToken()).toBeNull();
 rerender(<SessionProvider value={{status:'anonymous',user:null,login,logout}}><Read/></SessionProvider>);
 expect(screen.getByText('anonymous:none')).toBeVisible();expect(fetchMock).not.toHaveBeenCalled();
});
