import React from "react";
import {ProductProvider} from "./product-context";
import {NEXORA_PRODUCT} from "@pepbits/erp-config";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NavigationProvider } from "@pepbits/platform-ports";
import type { NavigationPort, NavigationTarget } from "@pepbits/platform-ports";

const authedFetch = vi.hoisted(() => vi.fn());
const useSession = vi.hoisted(() => vi.fn());
vi.mock("@pepbits/auth", () => ({ authedFetch, useSession }));

const { ERPProvider, useERP } = await import("./erp-context.tsx");

/**
 * The shell context.
 *
 * Preferences come from the SERVER, keyed by the signed-in user, and the shell
 * renders a fallback until they land — so it never paints in one theme and then
 * jumps to another. localStorage holds none of it, because two stores for one
 * setting is a reconciliation bug waiting to happen.
 */

const opened: NavigationTarget[] = [];
const navigation = (pageId = "customer-master"): NavigationPort => ({
  current: { pageId },
  open: (target) => opened.push(target),
  openInNewContext: (target) => opened.push({ ...target, title: "new-context" }),
  hrefFor: () => "#",
});

const settled = (preferences: unknown) => new Response(JSON.stringify({ preferences }), { status: 200 });
const unreachable = () => ({
  /* See auth's session.test.tsx: a genuinely rejected mock is reported by
     vitest as an unhandled error against an unrelated test. */
  then: (_resolve: unknown, reject: (error: unknown) => void) => reject(new TypeError("Failed to fetch")),
});

function Probe() {
  const erp = useERP();
  return (
    <div>
      <output data-testid="module">{erp.currentModule}</output>
      <output data-testid="theme">{erp.preferences.theme}</output>
      <output data-testid="toasts">{erp.toasts.map((toast) => toast.title).join("|")}</output>
      <output data-testid="command">{String(erp.commandOpen)}</output>
      <button onClick={() => erp.toast({ title: "one", tone: "info" } as never)}>toast one</button>
      <button onClick={() => erp.toast({ title: "two", tone: "info" } as never)}>toast two</button>
      <button onClick={() => erp.toast({ title: "three", tone: "info" } as never)}>toast three</button>
      <button onClick={() => erp.toast({ title: "four", tone: "info" } as never)}>toast four</button>
      <button onClick={() => erp.updatePreference("theme", "midnight" as never)}>dark</button>
      <button onClick={() => erp.resetPreferences()}>reset preferences</button>
      <input data-testid="field" />
    </div>
  );
}

const mount = (port = navigation()) =>
  render(
    <NavigationProvider value={port}>
      <ERPProvider fallback={<p>loading preferences</p>}><Probe /></ERPProvider>
    </NavigationProvider>,
  );

const ready = () => waitFor(() => expect(screen.getByTestId("theme")).toBeInTheDocument());
/* Dispatched at document.body by default, which is where a real key press
   starts when nothing else is focused; it bubbles to the shell's listener on
   window. There is a separate test for a synthetic event aimed at window
   itself, which used to kill the handler outright. */
const press = (init: KeyboardEventInit & { code: string }, target: EventTarget = document.body) =>
  act(() => {
    target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));
  });

beforeEach(() => {
  opened.length = 0;
  authedFetch.mockReset();
  authedFetch.mockResolvedValue(settled({}));
  useSession.mockReturnValue({ status: "authenticated", user: { branch: "dubai", role: "finance-manager" } });
  window.localStorage.clear();
});

afterEach(() => {vi.useRealTimers();vi.restoreAllMocks();});

describe("loading preferences", () => {
  /* The fallback is the whole reason the provider gates on `loaded`: painting
     with defaults and then correcting is a visible flash of the wrong theme. */
  test("renders the fallback until the server answers", async () => {
    let settle: (response: Response) => void = () => {};
    authedFetch.mockReturnValue(new Promise<Response>((resolve) => { settle = resolve; }));
    mount();
    expect(screen.getByText("loading preferences")).toBeInTheDocument();
    expect(screen.queryByTestId("theme")).toBeNull();
    await act(async () => { settle(settled({})); });
    await ready();
  });

  test("reads them from the server, not from storage", async () => {
    mount();
    await ready();
    expect(authedFetch).toHaveBeenCalledWith("/preferences",{headers:{"X-Product-Id":"nexora"}});
  });

  /* Validated, not spread. A theme id removed in a later release, or a
     hand-edited preferences.json, used to reach the shell verbatim and set
     data-theme to a selector no stylesheet defines. */
  test("a theme nobody defines does not reach the shell", async () => {
    authedFetch.mockResolvedValue(settled({ theme: "no-such-theme", density: "spacious" }));
    mount();
    await ready();
    expect(screen.getByTestId("theme").textContent).not.toBe("no-such-theme");
    /* And the valid neighbour in the same object still lands. */
    await waitFor(() => expect(document.documentElement.style.getPropertyValue("--row-py")).toBe("14px"));
  });

  test("an unreachable API falls through to defaults rather than blocking the shell", async () => {
    authedFetch.mockImplementation(() => unreachable() as unknown as Promise<Response>);
    mount();
    await ready();
    expect(screen.getByTestId("theme").textContent).toBe("nexora");
  });

  test("a refused request also renders, on defaults", async () => {
    authedFetch.mockResolvedValue(new Response("{}", { status: 500 }));
    mount();
    await ready();
    expect(screen.getByTestId("theme").textContent).toBe("nexora");
  });
});

describe("preferences on the document", () => {
  test("theme, density, radius and font are written as variables", async () => {
    authedFetch.mockResolvedValue(settled({ theme: "midnight", density: "compact", cornerRadius: 4, fontFamily: "georgia" }));
    mount();
    await ready();
    const root = document.documentElement;
    expect(root.dataset.theme).toBe("midnight");
    expect(root.style.getPropertyValue("--row-py")).toBe("6px");
    expect(root.style.getPropertyValue("--radius")).toBe("4px");
    expect(root.style.getPropertyValue("--font-ui")).toContain("Georgia");
  });

  /* A font nobody loaded is a choice that does nothing: the picker offered Inter
     and Manrope with neither loaded, on every machine that lacked them locally. */
  test("a font nobody knows falls back rather than writing an empty stack", async () => {
    authedFetch.mockResolvedValue(settled({ fontFamily: "comic-sans" }));
    mount();
    await ready();
    expect(document.documentElement.style.getPropertyValue("--font-ui")).toContain("Inter");
  });

  test("the language sets both lang and direction", async () => {
    authedFetch.mockResolvedValue(settled({ language: "ar" }));
    mount();
    await ready();
    expect(document.documentElement.lang).toBe("ar");
    expect(document.documentElement.dir).toBe("rtl");
  });

  test("changing a preference re-writes the document", async () => {
    mount();
    await ready();
    await act(async () => { screen.getByText("dark").click(); });
    expect(document.documentElement.dataset.theme).toBe("midnight");
  });
});

describe("toasts", () => {
  /* Trimmed on ADD, not at render. Keeping the overflow in state and showing
     only the last N leaves invisible toasts holding live dismiss timers, and a
     bulk action then drips them back one at a time as those fire. */
  test("never hold more than the preference allows", async () => {
    /* 3 is the default and one of the three values the preference admits --
       1, 3 or 5. Asking for 2 sanitises back to 3, so a test written against
       it would have been measuring the default and calling it the setting. */
    mount();
    await ready();
    for (const label of ["toast one", "toast two", "toast three", "toast four"]) {
      await act(async () => { screen.getByText(label).click(); });
    }
    expect(screen.getByTestId("toasts").textContent).toBe("two|three|four");
  });

  test("the newest survives the trim", async () => {
    authedFetch.mockResolvedValue(settled({ maxVisibleToasts: 1 }));
    mount();
    await ready();
    await act(async () => { screen.getByText("toast one").click(); });
    await act(async () => { screen.getByText("toast four").click(); });
    expect(screen.getByTestId("toasts").textContent).toBe("four");
  });

  test("two raised in the same millisecond are still two", async () => {
    /* The id is a timestamp plus randomness for exactly this reason: an id
       collision would make dismissing one dismiss both. */
    mount();
    await ready();
    await act(async () => {
      screen.getByText("toast one").click();
      screen.getByText("toast two").click();
    });
    expect(screen.getByTestId("toasts").textContent).toBe("one|two");
  });
});

describe("keyboard shortcuts", () => {
  test("open the command palette", async () => {
    mount();
    await ready();
    expect(screen.getByTestId("command").textContent).toBe("false");
    await press({ code: "KeyK", ctrlKey: true });
    expect(screen.getByTestId("command").textContent).toBe("true");
  });

  test("navigate to the module dashboard", async () => {
    mount();
    await ready();
    await press({ code: "KeyD", altKey: true });
    expect(opened).toContainEqual({ pageId: "finance-dashboard" });
  });

  /* Holding a shortcut used to append one tab per OS key-repeat event. */
  test("ignore an OS key repeat", async () => {
    mount();
    await ready();
    await press({ code: "KeyD", altKey: true, repeat: true });
    expect(opened).toEqual([]);
  });

  /* OFF UNBINDS, rather than binding and then ignoring. Someone who turns
     shortcuts off usually wants a key back — for a screen reader, the browser,
     an IME — and a listener that swallows the event before deciding not to act
     has still taken it. */
  test("turning them off releases the key rather than swallowing it", async () => {
    authedFetch.mockResolvedValue(settled({ keyboardShortcuts: false }));
    mount();
    await ready();
    const event = new KeyboardEvent("keydown", { code: "KeyD", altKey: true, bubbles: true, cancelable: true });
    act(() => { window.dispatchEvent(event); });
    expect(opened).toEqual([]);
    expect(event.defaultPrevented).toBe(false);
  });

  test("a shortcut that does act says so, so the browser does not act too", async () => {
    mount();
    await ready();
    const event = new KeyboardEvent("keydown", { code: "KeyD", altKey: true, bubbles: true, cancelable: true });
    act(() => { window.dispatchEvent(event); });
    expect(event.defaultPrevented).toBe(true);
  });

  test("typing in a field suppresses the shortcuts that would interrupt it", async () => {
    mount();
    await ready();
    await press({ code: "KeyD", altKey: true }, screen.getByTestId("field"));
    expect(opened).toEqual([]);
  });

  /* ⌘K is marked whileTyping precisely so it still works from a search box. */
  test("but not the ones declared to work while typing", async () => {
    mount();
    await ready();
    await press({ code: "KeyK", ctrlKey: true }, screen.getByTestId("field"));
    expect(screen.getByTestId("command").textContent).toBe("true");
  });

  /* The same predicate the help panel uses, so a key listed there always does
     something and a key that does nothing is never listed. The web shell has no
     workspace, and Alt+\ must not silently swallow the key there. */
  test("a workspace shortcut is inert, and unbound, in a shell with no workspace", async () => {
    mount();
    await ready();
    const event = new KeyboardEvent("keydown", { code: "Backslash", altKey: true, bubbles: true, cancelable: true });
    act(() => { window.dispatchEvent(event); });
    expect(event.defaultPrevented).toBe(false);
  });

  /* A synthetic event aimed at window rather than at an element: its target has
     no getAttribute, and calling one used to throw before the handler reached
     the shortcut loop -- leaving every shortcut in the shell dead, silently. */
  test("survive an event dispatched at window rather than at an element", async () => {
    mount();
    await ready();
    await press({ code: "KeyD", altKey: true }, window);
    expect(opened).toContainEqual({ pageId: "finance-dashboard" });
  });

  test("stop firing once the shell unmounts", async () => {
    const view = mount();
    await ready();
    view.unmount();
    await press({ code: "KeyD", altKey: true });
    expect(opened).toEqual([]);
  });
});

describe("the current module", () => {
  /* Derived from the navigation port, never stored. Two sources of truth for
     the active module was what stranded a foreign home tab in the desktop tab
     bar. */
  test("comes from where the user is", async () => {
    mount(navigation("customer-master"));
    await ready();
    expect(screen.getByTestId("module").textContent).toBe("finance");
  });

  test("and is remembered for the sidebar", async () => {
    mount(navigation("customer-master"));
    await ready();
    expect(window.localStorage.getItem("nexora-module")).toBe("finance");
  });
});

describe("useERP", () => {
  test("throws outside the provider rather than rendering an empty shell", () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/ERPProvider/);
    quiet.mockRestore();
  });
});

describe("preference write safety", () => {
  afterEach(() => vi.useRealTimers());
  const writes = () => authedFetch.mock.calls.filter(([, init]) => init?.method === "PUT");
  test.each(["http", "offline", "malformed", "missing", "array"])("a %s load failure never overwrites stored preferences", async (failure) => {
    if (failure === "offline") authedFetch.mockImplementation(() => unreachable());
    else authedFetch.mockResolvedValue(new Response(failure === "malformed" ? "null" : failure === "array" ? '{"preferences":[]}' : "{}", { status: failure === "http" ? 503 : 200 }));
    mount();
    await ready();
    vi.useFakeTimers();
    await act(async () => { screen.getByText("dark").click(); });
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(writes()).toHaveLength(0);
    expect(document.documentElement.dataset.theme).toBe("nexora");
  });
  test("loading alone does not write; explicit edits do, including reverting to defaults", async () => {
    mount(); await ready();
    vi.useFakeTimers();
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(writes()).toHaveLength(0);
    await act(async () => { screen.getByText("dark").click(); });
    await act(async () => { vi.advanceTimersByTime(400); });
    expect(writes()).toHaveLength(1);
    await act(async () => { screen.getByText("reset preferences").click(); });
    await act(async () => { vi.advanceTimersByTime(400); });
    expect(writes()).toHaveLength(2);
    expect(JSON.parse(writes()[1][1].body).preferences.theme).toBeUndefined();
  });
  test("the skeleton preference is remembered after a successful load", async () => {
    authedFetch.mockResolvedValue(settled({ loadingSkeletons: false }));
    mount(); await ready();
    expect(localStorage.getItem("nexora-loading-skeletons")).toBe("false");
  });
});


test("a pending language switch preserves a later theme edit", async () => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const loadLanguage = vi.fn((language: string) => language === "ar" ? pending : Promise.resolve());
  let context!: ReturnType<typeof useERP>;
  function SettingsProbe() { context = useERP(); return <output data-testid="race-language">{context.preferences.language}</output>; }
  render(<ProductProvider product={NEXORA_PRODUCT} loadLanguage={loadLanguage}><NavigationProvider value={navigation()}><ERPProvider><SettingsProbe /></ERPProvider></NavigationProvider></ProductProvider>);
  await waitFor(() => expect(context.preferencesAvailable).toBe(true));
  act(() => context.updatePreference("language", "ar"));
  expect(context.preferences.language).toBe("en");
  act(() => context.updatePreference("theme", "midnight" as never));
  await act(async () => { release(); await pending; });
  expect(context.preferences.language).toBe("ar");
  expect(context.preferences.theme).toBe("midnight");
});

test("locked preferences resist shared updates and resets without writing an override",async()=>{
 authedFetch.mockImplementation(()=>Promise.resolve(new Response(JSON.stringify({preferences:{},policy:{revision:1,rules:{theme:{value:'sand',locked:true}}},userRevision:0}))));
 mount();await ready();expect(screen.getByTestId('theme')).toHaveTextContent('sand');vi.useFakeTimers();
 await act(async()=>{screen.getByText('dark').click();});
 expect(screen.getByTestId('theme')).toHaveTextContent('sand');
 await act(async()=>{screen.getByText('reset preferences').click();vi.advanceTimersByTime(400);});
 const writes=authedFetch.mock.calls.filter(([,init])=>init?.method==='PUT');
 for(const [,init] of writes)expect(JSON.parse(init.body).preferences.theme).toBeUndefined();
 expect(screen.getByTestId('theme')).toHaveTextContent('sand');
});

test("a refreshed language lock cancels a pending personal language switch",async()=>{
 let release!:()=>void;const pending=new Promise<void>(resolve=>{release=resolve;});
 const loadLanguage=(language:string)=>language==='ar'?pending:Promise.resolve();let revision=0;
 authedFetch.mockImplementation(()=>Promise.resolve(new Response(JSON.stringify({preferences:{},policy:{revision,rules:revision?{language:{value:'hi',locked:true}}:{}}}))));
 function LanguageProbe(){const erp=useERP();return <><output data-testid="policy-language">{erp.preferences.language}</output><output data-testid="policy-ready">{String(erp.preferencesAvailable)}</output><button onClick={()=>erp.updatePreference('language','ar')}>arabic</button><button onClick={()=>void erp.refreshPreferences()}>refresh policy</button></>;}
 render(<NavigationProvider value={navigation()}><ProductProvider product={NEXORA_PRODUCT} loadLanguage={loadLanguage}><ERPProvider><LanguageProbe /></ERPProvider></ProductProvider></NavigationProvider>);
 await waitFor(()=>expect(screen.getByTestId('policy-ready')).toHaveTextContent('true'));
 await act(async()=>{screen.getByText('arabic').click();});revision=1;
 await act(async()=>{screen.getByText('refresh policy').click();});
 await waitFor(()=>expect(screen.getByTestId('policy-language')).toHaveTextContent('hi'));
 await act(async()=>{release();await pending;});expect(screen.getByTestId('policy-language')).toHaveTextContent('hi');
});

test("preference saves serialize later edits against the latest server revision",async()=>{
 let finish!: (response:Response)=>void;let puts=0;
 authedFetch.mockImplementation((_path,init)=>{
  if(init?.method!=='PUT')return Promise.resolve(new Response(JSON.stringify({preferences:{},userRevision:0,policy:{revision:0,rules:{}}})));
  if(++puts===1)return new Promise<Response>(resolve=>{finish=resolve;});
  return Promise.resolve(new Response(JSON.stringify({userRevision:2})));
 });
 function FontProbe(){const erp=useERP();return <><output data-testid="policy-ready">{String(erp.preferencesAvailable)}</output><button onClick={()=>erp.updatePreference('fontSizeBase',14)}>font14</button><button onClick={()=>erp.updatePreference('fontSizeBase',15)}>font15</button></>;}
 render(<NavigationProvider value={navigation()}><ERPProvider><FontProbe /></ERPProvider></NavigationProvider>);
 await waitFor(()=>expect(screen.getByTestId('policy-ready')).toHaveTextContent('true'));vi.useFakeTimers();
 await act(async()=>{screen.getByText('font14').click();});await act(async()=>{vi.advanceTimersByTime(400);});
 await act(async()=>{screen.getByText('font15').click();});await act(async()=>{vi.advanceTimersByTime(400);});expect(puts).toBe(1);
 await act(async()=>{finish(new Response(JSON.stringify({userRevision:1})));});await act(async()=>{vi.advanceTimersByTime(400);});
 const writes=authedFetch.mock.calls.filter(([,init])=>init?.method==='PUT');expect(writes).toHaveLength(2);
 expect(JSON.parse(writes[1][1].body)).toMatchObject({userRevision:1,preferences:{fontSizeBase:15}});
});

test('bulk preference updates cannot apply values excluded by tenant policy',async()=>{
 authedFetch.mockImplementation(()=>Promise.resolve(new Response(JSON.stringify({preferences:{},policy:{revision:1,rules:{theme:{value:'sand',locked:false,allowedValues:['sand','nord']}}},userRevision:0}))));
 function Choices(){const erp=useERP();return <><output data-testid="choice">{erp.preferences.theme}</output><button onClick={()=>erp.updatePreferences({theme:'midnight'})}>excluded</button><button onClick={()=>erp.updatePreferences({theme:'nord'})}>allowed</button></>;}
 render(<NavigationProvider value={navigation()}><ERPProvider><Choices/></ERPProvider></NavigationProvider>);
 await waitFor(()=>expect(screen.getByTestId('choice')).toHaveTextContent('sand'));
 await act(async()=>screen.getByText('excluded').click());expect(screen.getByTestId('choice')).toHaveTextContent('sand');
 await act(async()=>screen.getByText('allowed').click());expect(screen.getByTestId('choice')).toHaveTextContent('nord');
});

test('host branch changes use the latest authorized options after asynchronous loading',async()=>{
 const {ShellHostProvider}=await import('./shell-host');const changed=vi.fn();
 authedFetch.mockImplementation(()=>Promise.resolve(settled({})));
 function Branch(){const erp=useERP();return <button onClick={()=>erp.setBranch('2')}>select host branch</button>;}
 const tree=(branches:Array<{value:string;label:string}>)=><NavigationProvider value={navigation()}><ShellHostProvider value={{branch:'',branches,onBranchChange:changed,tenantLabel:'Synthetic',statusLabel:'Signed in',versionLabel:'Test'}}><ERPProvider><Branch/></ERPProvider></ShellHostProvider></NavigationProvider>;
 const view=render(tree([]));await waitFor(()=>expect(screen.getByText('select host branch')).toBeVisible());await act(async()=>screen.getByText('select host branch').click());expect(changed).not.toHaveBeenCalled();
 view.rerender(tree([{value:'2',label:'Verified branch'}]));await act(async()=>screen.getByText('select host branch').click());expect(changed).toHaveBeenCalledWith('2');
});
