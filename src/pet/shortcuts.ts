export type PetShortcut =
  | "feed" | "water" | "play" | "rest" | "peek"
  | "dance" | "typing" | "bark" | "jump" | "settings";

export const PET_SHORTCUT_LABEL =
  "F feed · W water · P play · R rest · N peek · D dance · T typing · B bark · J jump · S settings";

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
    case "n": return "peek";
    case "d": return "dance";
    case "t": return "typing";
    case "b": return "bark";
    case "j": return "jump";
    case "s": return "settings";
    default: return null;
  }
}
