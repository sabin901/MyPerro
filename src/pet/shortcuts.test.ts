import { describe, expect, it } from "vitest";
import { PET_SHORTCUT_LABEL, petShortcutForKey } from "./shortcuts";

describe("pet-only keyboard shortcuts", () => {
  it("maps each action to its first letter", () => {
    expect(petShortcutForKey({ key: "f" })).toBe("feed");
    expect(petShortcutForKey({ key: "W" })).toBe("water");
    expect(petShortcutForKey({ key: "p" })).toBe("play");
    expect(petShortcutForKey({ key: "R" })).toBe("rest");
    expect(petShortcutForKey({ key: "n" })).toBe("peek");
    expect(petShortcutForKey({ key: "H" })).toBe("headphones");
    expect(petShortcutForKey({ key: "d" })).toBe("dance");
    expect(petShortcutForKey({ key: "T" })).toBe("typing");
    expect(petShortcutForKey({ key: "b" })).toBe("bark");
    expect(petShortcutForKey({ key: "J" })).toBe("jump");
    expect(petShortcutForKey({ key: "s" })).toBe("settings");
  });

  it("does not capture shortcuts with system modifiers or key repeat", () => {
    expect(petShortcutForKey({ key: "f", ctrlKey: true })).toBeNull();
    expect(petShortcutForKey({ key: "w", altKey: true })).toBeNull();
    expect(petShortcutForKey({ key: "p", metaKey: true })).toBeNull();
    expect(petShortcutForKey({ key: "r", repeat: true })).toBeNull();
  });

  it("ignores unrelated keys and publishes the discoverability label", () => {
    expect(petShortcutForKey({ key: "x" })).toBeNull();
    expect(PET_SHORTCUT_LABEL).toContain("S settings");
    expect(PET_SHORTCUT_LABEL).toContain("N peek");
  });
});
