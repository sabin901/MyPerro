import { describe, it, expect } from "vitest";
import {
  normaliseSettings, personalise, DEFAULT_SETTINGS, CURRENT_SCHEMA, REMINDER_TEXT,
  BREED_PRESETS, BUILT_IN_BREEDS,
} from "./settings";

describe("normaliseSettings", () => {
  it("returns defaults for junk input", () => {
    expect(normaliseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(normaliseSettings("nonsense")).toEqual(DEFAULT_SETTINGS);
    expect(normaliseSettings(42)).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps good values and fills missing ones", () => {
    const s = normaliseSettings({ ownerName: "Sabin", waterEveryMinutes: 15 });
    expect(s.ownerName).toBe("Sabin");
    expect(s.waterEveryMinutes).toBe(15);
    expect(s.stretchEveryMinutes).toBe(DEFAULT_SETTINGS.stretchEveryMinutes);
  });

  it("clamps out-of-range numbers instead of trusting them", () => {
    expect(normaliseSettings({ waterEveryMinutes: 0 }).waterEveryMinutes).toBe(1);
    expect(normaliseSettings({ waterEveryMinutes: 99999 }).waterEveryMinutes).toBe(1440);
    expect(normaliseSettings({ pomodoro: { focusMinutes: -5 } }).pomodoro.focusMinutes).toBe(1);
    expect(normaliseSettings({ playRequestMinutes: 1 }).playRequestMinutes).toBe(5);
    expect(normaliseSettings({ playRequestMinutes: 999 }).playRequestMinutes).toBe(240);
  });

  it("rejects a bad hour but keeps a good one", () => {
    expect(normaliseSettings({ quietFrom: 25 }).quietFrom).toBeNull();
    expect(normaliseSettings({ quietFrom: 22 }).quietFrom).toBe(22);
  });

  it("rejects a malformed colour", () => {
    expect(normaliseSettings({ appearance: { baseColor: "red" } }).appearance.baseColor)
      .toBe(DEFAULT_SETTINGS.appearance.baseColor);
    expect(normaliseSettings({ appearance: { baseColor: "#AABBCC" } }).appearance.baseColor)
      .toBe("#AABBCC");
  });

  it("accepts only built-in breed ids", () => {
    expect(normaliseSettings({ appearance: { breed: "husky" } }).appearance.breed).toBe("husky");
    expect(normaliseSettings({ appearance: { breed: "calico-cat" } }).appearance.breed).toBe("calico-cat");
    expect(normaliseSettings({ appearance: { breed: "../bad" } }).appearance.breed)
      .toBe(DEFAULT_SETTINGS.appearance.breed);
  });

  it("has a complete preset for every built-in companion", () => {
    for (const id of BUILT_IN_BREEDS) {
      const preset = BREED_PRESETS[id as keyof typeof BREED_PRESETS];
      expect(preset.label.length).toBeGreaterThan(0);
      expect(["Dog", "Cat"]).toContain(preset.species);
      expect(preset.petName.length).toBeGreaterThan(0);
      expect(normaliseSettings({
        petName: preset.petName,
        appearance: {
          breed: id,
          baseColor: preset.baseColor,
          markingColor: preset.markingColor,
          collarColor: preset.collarColor,
          markingStyle: preset.markingStyle,
        },
      }).appearance.breed).toBe(id);
    }
  });

  it("accepts known marking styles and rejects unknown ones", () => {
    expect(normaliseSettings({ appearance: { markingStyle: "freckles" } }).appearance.markingStyle)
      .toBe("freckles");
    expect(normaliseSettings({ appearance: { markingStyle: "tiger" } }).appearance.markingStyle)
      .toBe(DEFAULT_SETTINGS.appearance.markingStyle);
  });

  it("never lets petName become empty", () => {
    expect(normaliseSettings({ petName: "" }).petName).toBe(DEFAULT_SETTINGS.petName);
  });

  it("truncates over-long strings rather than storing a novel in a note", () => {
    const long = "x".repeat(500);
    expect(normaliseSettings({ pinnedNote: long }).pinnedNote.length).toBe(120);
    expect(normaliseSettings({ scheduledMessage: { text: long } }).scheduledMessage.text.length).toBe(120);
  });

  it("always stamps the current schema version", () => {
    expect(normaliseSettings({ schemaVersion: 0 }).schemaVersion).toBe(CURRENT_SCHEMA);
  });

  it("keeps a valid scheduled message and rejects malformed times", () => {
    const s = normaliseSettings({
      scheduledMessage: {
        enabled: true,
        at: "2026-08-09T15:30",
        text: "time to check the oven",
      },
    });
    expect(s.scheduledMessage).toEqual({
      enabled: true,
      at: "2026-08-09T15:30",
      text: "time to check the oven",
    });

    expect(normaliseSettings({ scheduledMessage: { at: "tomorrow" } }).scheduledMessage.at).toBe("");
  });

  it("persists peek mode as a simple safe toggle", () => {
    expect(normaliseSettings({ peekMode: true }).peekMode).toBe(true);
    expect(normaliseSettings({ peekMode: "yes" }).peekMode).toBe(false);
  });

  it("clamps desktop presence controls", () => {
    expect(normaliseSettings({ appearance: { scale: 0.1, opacity: 2 } }).appearance)
      .toMatchObject({ scale: 0.65, opacity: 1 });
    expect(normaliseSettings({ appearance: { scale: 1.25, opacity: 0.7 } }).appearance)
      .toMatchObject({ scale: 1.25, opacity: 0.7 });
    expect(normaliseSettings({ appearance: { scale: 8 } }).appearance.scale).toBe(2);
    expect(normaliseSettings({ alwaysOnTop: false }).alwaysOnTop).toBe(false);
  });
});

describe("personalise", () => {
  it("inserts the owner's name", () => {
    expect(personalise("{name}, time to stretch!", "Sabin")).toBe("Sabin, time to stretch!");
  });

  it("reads naturally when no name is set", () => {
    const out = personalise("{name}, time to stretch!", "");
    expect(out).toBe("time to stretch!");
    expect(out.startsWith(",")).toBe(false);
  });

  it("substitutes a mid-sentence token with a friendly fallback", () => {
    expect(personalise("hydrate now, {name}", "")).toBe("hydrate now, friend");
  });

  it("trims stray whitespace from the name", () => {
    expect(personalise("hi {name}", "  Sabin  ")).toBe("hi Sabin");
  });

  it("every built-in reminder line reads cleanly with no name set", () => {
    for (const template of Object.values(REMINDER_TEXT)) {
      const out = personalise(template, "");
      expect(out).not.toContain("{name}");
      expect(out).not.toMatch(/^\s*,/);
      expect(out).not.toMatch(/\s{2,}/);
    }
  });

  it("every built-in reminder line reads cleanly WITH a name", () => {
    for (const template of Object.values(REMINDER_TEXT)) {
      const out = personalise(template, "Sabin");
      expect(out).toContain("Sabin");
      expect(out).not.toContain("{name}");
    }
  });
});
