import React from "react";
import {act, render, screen, waitFor, fireEvent} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, test, vi} from "vitest";
import type {UserPreferences} from "@pepbits/preferences";
import type {NavigationPort, NavigationTarget} from "@pepbits/platform/navigation";
import {ShellTestHost, port, product} from "./test/host";
import {useERP, useShell} from "./shell-context";
const opened: NavigationTarget[] = [];
let settings: Partial<UserPreferences> = {};
const navigation = (pageId = "items"): NavigationPort => ({current:{pageId},open:target=>opened.push(target),openInNewContext:target=>opened.push({...target,title:"new-context"}),hrefFor:()=>"#"});
function Probe(){const erp=useERP();return <><output data-testid="module">{erp.currentModule}</output><output data-testid="theme">{erp.preferences.theme}</output><output data-testid="toasts">{erp.toasts.map(toast=>toast.title).join("|")}</output><output data-testid="command">{String(erp.commandOpen)}</output>{["one","two","three","four"].map(title=><button key={title} onClick={()=>erp.toast({title,type:"info"})}>toast {title}</button>)}<input data-testid="field" /></>;}
const mount=(port=navigation())=>render(<ShellTestHost navigation={port} settings={{preferences:settings}}><Probe /></ShellTestHost>);
const ready=()=>waitFor(()=>expect(screen.getByTestId("theme")).toBeInTheDocument());
const press=(init:KeyboardEventInit & {code:string},target:EventTarget=document.body)=>act(()=>{target.dispatchEvent(new KeyboardEvent("keydown",{bubbles:true,cancelable:true,...init}));});
beforeEach(()=>{settings={};opened.length=0;});
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});
test('current module follows navigation and shared pages retain the last module', () => {
  const tree=(pageId:string)=><ShellTestHost navigation={navigation(pageId)}><Probe /></ShellTestHost>;
  const view=render(tree('resources-dashboard'));
  expect(screen.getByTestId('module')).toHaveTextContent('resources');
  view.rerender(tree('preferences'));
  expect(screen.getByTestId('module')).toHaveTextContent('resources');
});
test('missing providers fail explicitly', () => {
  function Probe(){useShell();return null;}
  expect(()=>render(<Probe/>)).toThrow(/ShellProvider/);
});
test('shortcut disablement removes its existing listener on a live policy change', () => {
  const add=vi.spyOn(window,'addEventListener'),remove=vi.spyOn(window,'removeEventListener');
  const tree=(enabled:boolean)=><ShellTestHost settings={{preferences:{keyboardShortcuts:enabled}}}><Probe/></ShellTestHost>;
  const view=render(tree(true));
  const binding=add.mock.calls.find(([event])=>event==='keydown')!;
  expect(binding).toBeDefined();view.rerender(tree(false));
  expect(remove).toHaveBeenCalledWith('keydown',binding[1]);
  press({code:'KeyK',ctrlKey:true});expect(screen.getByTestId('command')).toHaveTextContent('false');
});
test('effective locks disable controls, guard stale handlers and use only the host update path', () => {
  const update=vi.fn();let erp!:ReturnType<typeof useERP>;
  function Control(){erp=useERP();return <button disabled={erp.isPreferenceLocked('sidebarPinned')} onClick={()=>erp.updatePreference('sidebarPinned',false)}>Pin</button>;}
  const tree=(locked:boolean)=><ShellTestHost settings={{preferences:{sidebarPinned:false},update,preferencePolicy:{revision:1,rules:{sidebarPinned:{value:true,locked}}}}}><Control/></ShellTestHost>;
  const view=render(tree(false));const retained=erp.updatePreference;
  view.rerender(tree(true));expect(screen.getByRole('button',{name:'Pin'})).toBeDisabled();expect(erp.preferences.sidebarPinned).toBe(true);
  act(()=>{void retained('sidebarPinned',false);});expect(update).not.toHaveBeenCalled();
  view.rerender(tree(false));fireEvent.click(screen.getByRole('button',{name:'Pin'}));expect(update).toHaveBeenCalledWith({sidebarPinned:false});
  expect(erp.preferences.sidebarPinned).toBe(false);
});
test('a host update needs acknowledgement and never creates an optimistic preference store',()=>{
  const update=vi.fn();let erp!:ReturnType<typeof useERP>;
  function Control(){erp=useERP();return null;}
  const tree=(theme:'sand'|'midnight')=><ShellTestHost settings={{preferences:{theme},update}}><Control/></ShellTestHost>;
  const view=render(tree('sand'));act(()=>{void erp.updatePreference('theme','midnight');});
  expect(update).toHaveBeenCalledWith({theme:'midnight'});expect(erp.preferences.theme).toBe('sand');
  view.rerender(tree('midnight'));expect(erp.preferences.theme).toBe('midnight');
});
test('bulk preference updates reject policy-excluded values',()=>{
  const update=vi.fn();let erp!:ReturnType<typeof useERP>;function Probe(){erp=useERP();return null;}
  render(<ShellTestHost settings={{update,preferencePolicy:{revision:1,rules:{theme:{value:'sand',allowedValues:['sand','nord'],locked:false}}}}}><Probe/></ShellTestHost>);
  act(()=>{void erp.updatePreferences({theme:'midnight'});});expect(update).not.toHaveBeenCalled();
  act(()=>{void erp.updatePreferences({theme:'nord'});});expect(update).toHaveBeenCalledWith({theme:'nord'});
});
test('host branch changes use the latest authorized options after asynchronous loading',()=>{
  const changed=vi.fn();function Branch(){const shell=useShell();return <button onClick={()=>shell.setBranch('second')}>Branch</button>;}
  const tree=(loaded:boolean)=><ShellTestHost onBranchChange={changed} branches={loaded?[{value:'second',label:'Second'}]:[]}><Branch/></ShellTestHost>;
  const view=render(tree(false));fireEvent.click(screen.getByRole('button'));expect(changed).not.toHaveBeenCalled();
  view.rerender(tree(true));fireEvent.click(screen.getByRole('button'));expect(changed).toHaveBeenCalledWith('second');
});
test('effective appearance applies independent scales, reduced motion and localization direction',()=>{
  render(<ShellTestHost settings={{preferences:{theme:'midnight',density:'compact',cornerRadius:4,fontFamily:'georgia',fontSizeBase:14,fontSizeForm:15,fontSizeResult:16,language:'ar',reducedMotion:true}}}><Probe/></ShellTestHost>);
  const root=document.documentElement;expect(root.dataset.theme).toBe('midnight');expect(root.dataset.reducedMotion).toBe('true');expect(root.dir).toBe('rtl');expect(root.lang).toBe('ar');
  expect(root.style.getPropertyValue('--radius')).toBe('4px');expect(root.style.getPropertyValue('--row-py')).toBe('6px');expect(root.style.getPropertyValue('--font-ui')).toContain('Georgia');
  expect(root.style.getPropertyValue('--fs-shell')).toBe(String(14/13));expect(root.style.getPropertyValue('--fs-form')).toBe(String(15/13));expect(root.style.getPropertyValue('--fs-result')).toBe(String(16/13));
});
test('invalid host preference values fall back to the existing preference resolver',()=>{
  render(<ShellTestHost settings={{preferences:{theme:'unknown',fontFamily:'unknown',density:'spacious'} as never}}><Probe/></ShellTestHost>);
  expect(document.documentElement.dataset.theme).not.toBe('unknown');expect(document.documentElement.style.getPropertyValue('--font-ui')).toContain('Inter');expect(document.documentElement.style.getPropertyValue('--row-py')).toBe('14px');
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
    settings = {maxVisibleToasts: 1};
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
    expect(opened).toContainEqual({ pageId: "operations-dashboard" });
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
    settings = {keyboardShortcuts: false};
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
    expect(opened).toContainEqual({ pageId: "operations-dashboard" });
  });

  test("stop firing once the shell unmounts", async () => {
    const view = mount();
    await ready();
    view.unmount();
    await press({ code: "KeyD", altKey: true });
    expect(opened).toEqual([]);
  });
});

