/**
 * Keyboard shortcuts, as a registry rather than a scatter of key checks.
 *
 * They were four `if` statements inside the ERP context, and the help panel
 * listed them again by hand. Two lists of the same thing drift, and the one that
 * drifts is the documentation — you find out a shortcut moved when someone
 * complains the help is wrong, not when it stops working.
 *
 * This is the single list. The binder loops over it, the help panel renders it,
 * and the preferences page counts it. A shortcut added here appears in all three
 * without anyone remembering to.
 *
 * `code`, NOT `key`. Option+N on a macOS US layout produces the tilde dead key
 * and reports `event.key === "Dead"`, so every key-based match was silently
 * broken on every Mac. `code` is the physical key and does not move.
 */
export type ShortcutModifier = "mod" | "alt" | "none";

export interface ShortcutDefinition {
  id: string;
  /** How it is written for a human. ⌘ is swapped for Ctrl off macOS at render. */
  display: string;
  code: string;
  modifier: ShortcutModifier;
  /** Shift must also be held. Kept explicit rather than inferred from `display`. */
  shift?: boolean;
  group: "Navigation" | "Workspace" | "Help";
  /**
   * A capability the shell must have for this to do anything.
   *
   * Read by the dispatcher AND by the help panel, so a shortcut cannot be
   * listed somewhere it would silently do nothing — the web shell has no
   * workspace yet, and a split key printed in its help is a promise it cannot
   * keep.
   */
  requires?: "workspace";
  label: string;
  /**
   * Whether it still fires while the caret is in a field.
   *
   * Almost nothing should. A bare `?` that opens help while someone types a
   * question into a note is the shortcut people disable the whole feature over.
   * Modified combinations are safe because they cannot be typed by accident.
   */
  whileTyping?: boolean;
}

export const SHORTCUTS: ShortcutDefinition[] = [
  { id: "command",     display: "⌘K",    code: "KeyK",   modifier: "mod",  group: "Navigation", label: "Open the command palette", whileTyping: true },
  { id: "preferences", display: "⌘,",    code: "Comma",  modifier: "mod",  group: "Navigation", label: "Open my preferences",      whileTyping: true },
  { id: "dashboard",   display: "Alt+D", code: "KeyD",   modifier: "alt",  group: "Navigation", label: "Go to the module dashboard" },
  { id: "search",      display: "Alt+/", code: "Slash",  modifier: "alt",  group: "Navigation", label: "Search the menu" },
  { id: "newRecord",   display: "Alt+N", code: "KeyN",   modifier: "alt",  group: "Workspace",  label: "New record in a new tab" },
  { id: "pinSidebar",  display: "Alt+S", code: "KeyS",   modifier: "alt",  group: "Workspace",  label: "Pin or unpin the sidebar" },
  /* Backslash, because it is the key VS Code and every editor since has used
     for splitting, and because it is free of the letters the module and record
     shortcuts already hold. */
  { id: "split",       display: "Alt+\\", code: "Backslash", modifier: "alt", group: "Workspace", requires: "workspace", label: "Show this document beside the last one" },
  { id: "exitSplit",   display: "Alt+Shift+\\", code: "Backslash", modifier: "alt", shift: true, group: "Workspace", requires: "workspace", label: "Collapse the split to one document" },
  { id: "help",        display: "?",     code: "Slash",  modifier: "none", shift: true, group: "Help", label: "Open the page helper" },
];

/** Whether this shell can run that shortcut at all. One predicate, two readers. */
export function shortcutAvailable(shortcut: ShortcutDefinition, capabilities: { workspace: boolean }): boolean {
  return shortcut.requires !== "workspace" || capabilities.workspace;
}

/** True when this event is that shortcut. The one place the comparison lives. */
export function matchesShortcut(
  shortcut: ShortcutDefinition,
  event: { code: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean },
): boolean {
  if (event.code !== shortcut.code) return false;
  if (Boolean(shortcut.shift) !== event.shiftKey) return false;
  const mod = event.metaKey || event.ctrlKey;
  if (shortcut.modifier === "mod") return mod && !event.altKey;
  if (shortcut.modifier === "alt") return event.altKey && !mod;
  return !mod && !event.altKey;
}

/** ⌘ is a Mac key. Showing it to a Windows user is a shortcut they will not find. */
export function displayFor(shortcut: ShortcutDefinition, apple: boolean): string {
  return apple ? shortcut.display : shortcut.display.replace("⌘", "Ctrl+");
}

export const SHORTCUT_GROUPS = ["Navigation", "Workspace", "Help"] as const;

/**
 * Broadcast when the menu-search shortcut fires.
 *
 * An event rather than a call, because the ERP context cannot reach into the
 * sidebar's input and should not learn how to. The sidebar owns its own focus;
 * the shortcut only says that someone asked for it.
 */
export const SIDEBAR_SEARCH_EVENT = "pepbits:focus-menu-search";
