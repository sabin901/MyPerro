export type PetShortcut = "feed" | "water" | "play" | "rest" | "settings";

export const PET_SHORTCUT_LABEL = "F feed · W water · P play · R rest · S settings";

interface ShortcutKey {
  key: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  repeat?: boolean;
}

/**
 * Single-letter controls only apply while the pet window is focused. Keeping
 * this local (rather than registering system-wide letters) prevents MyPerro
 * from stealing ordinary typing from the user's other applications.
 */
export function petShortcutForKey(event: ShortcutKey): PetShortcut | null {
  if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return null;
  switch (event.key.toLowerCase()) {
    case "f": return "feed";
    case "w": return "water";
    case "p": return "play";
    case "r": return "rest";
    case "s": return "settings";
    default: return null;
  }
}
