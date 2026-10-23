import {expect,test} from 'vitest';
import {SHORTCUTS,SHORTCUT_GROUPS,matchesShortcut,shortcutAvailable,displayFor} from './shortcuts';
test.each(SHORTCUTS)('$id matches physical code and exact modifiers',shortcut=>{
  const event={code:shortcut.code,key:'Dead',metaKey:shortcut.modifier==='mod',ctrlKey:false,altKey:shortcut.modifier==='alt',shiftKey:!!shortcut.shift};
  expect(matchesShortcut(shortcut,event)).toBe(true);expect(matchesShortcut(shortcut,{...event,shiftKey:!event.shiftKey})).toBe(false);expect(matchesShortcut(shortcut,{...event,code:'Unknown'})).toBe(false);expect(SHORTCUT_GROUPS).toContain(shortcut.group);
});
test('help and dispatcher share capability checks and platform display',()=>{
  const split=SHORTCUTS.find(s=>s.id==='split')!,command=SHORTCUTS.find(s=>s.id==='command')!;
  expect(shortcutAvailable(split,{workspace:false})).toBe(false);expect(shortcutAvailable(split,{workspace:true})).toBe(true);expect(shortcutAvailable(command,{workspace:false})).toBe(true);expect(displayFor(command,true)).toBe('⌘K');expect(displayFor(command,false)).toBe('Ctrl+K');
});
