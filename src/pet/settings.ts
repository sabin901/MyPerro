/**
 * Phase 4 — user settings.
 *
 * Everything the user can change lives in one plain object. It is the only
 * state we persist to disk, and it maps almost one-to-one onto ComNyang's
 * options: the dog's name, your name, a pinned note, reminder timings, quiet
 * hours, Pomodoro lengths, sound, and appearance.
 *
 * The functions here are boring on purpose — load, save, merge, and fill in a
 * reminder template with your name. Boring is correct for a settings layer;
 * the interesting logic is in scheduler.ts and engine.ts.
 */

import type { PomodoroConfig } from "./scheduler";
import { DEFAULT_POMODORO } from "./scheduler";

export interface ScheduledMessage {
  enabled: boolean;
  at: string;      // local datetime from <input type="datetime-local">
  text: string;
}

export interface Appearance {
  breed: string;          // stable companion id, e.g. "shiba-inu" or "calico-cat"
  baseColor: string;      // hex
  markingColor: string;   // hex
  collarColor: string;    // hex
  markingStyle: string;   // "classic" | "mask" | "patch" | "freckles"
  scale: number;          // 0.65–2 desktop size multiplier
  opacity: number;        // 0.5–1 visual opacity
}

export interface Settings {
  /** Bumped when the shape changes, so old saved files can be migrated. */
  schemaVersion: number;

  ownerName: string;      // what the dog calls you, "" if not set
  petName: string;        // the dog's name

  /** Pinned note shown above the dog's head. Empty = hidden. */
  pinnedNote: string;
  scheduledMessage: ScheduledMessage;

  stretchEnabled: boolean;
  stretchEveryMinutes: number;
  waterEnabled: boolean;
  waterEveryMinutes: number;
  playRequestEnabled: boolean;
  playRequestMinutes: number;

  quietFrom: number | null;  // 0–23, or null for none
  quietTo: number | null;

  pomodoro: PomodoroConfig;

  soundEnabled: boolean;
  soundVolume: number;
  reducedMotion: boolean;
  startAtLogin: boolean;
  inputMonitoringEnabled: boolean;
  notificationsEnabled: boolean;
  onboardingComplete: boolean;
  peekMode: boolean;
  alwaysOnTop: boolean;

  appearance: Appearance;
}

export const CURRENT_SCHEMA = 5;
export const BUILT_IN_BREEDS = [
  "shiba-inu", "pomeranian", "husky", "german-shepherd", "dalmatian", "lhasa-apso",
  "calico-cat", "midnight-cat", "cream-tabby",
] as const;

export const BREED_PRESETS = {
  "shiba-inu": {
    label: "Shiba Inu",
    species: "Dog",
    petName: "Mochi",
    baseColor: "#D9843C",
    markingColor: "#F5CD98",
    collarColor: "#D6453C",
    markingStyle: "classic",
  },
  "pomeranian": {
    label: "Pomeranian",
    species: "Dog",
    petName: "PomPom",
    baseColor: "#E19B58",
    markingColor: "#FFE1AC",
    collarColor: "#C95D4B",
    markingStyle: "classic",
  },
  husky: {
    label: "Husky",
    species: "Dog",
    petName: "Nova",
    baseColor: "#607080",
    markingColor: "#EFF4F0",
    collarColor: "#3D78B2",
    markingStyle: "mask",
  },
  "german-shepherd": {
    label: "German Shepherd",
    species: "Dog",
    petName: "Scout",
    baseColor: "#B77737",
    markingColor: "#3D342B",
    collarColor: "#B94635",
    markingStyle: "patch",
  },
  dalmatian: {
    label: "Dalmatian",
    species: "Dog",
    petName: "Dot",
    baseColor: "#EAE9DC",
    markingColor: "#363431",
    collarColor: "#D6453C",
    markingStyle: "freckles",
  },
  "lhasa-apso": {
    label: "Lhasa Apso",
    species: "Dog",
    petName: "Lhasa",
    baseColor: "#BE9A69",
    markingColor: "#F5E2B8",
    collarColor: "#6D8B55",
    markingStyle: "classic",
  },
  "calico-cat": {
    label: "Calico Cat",
    species: "Cat",
    petName: "Mikan",
    baseColor: "#F7E5C5",
    markingColor: "#C87543",
    collarColor: "#B84B68",
    markingStyle: "patch",
  },
  "midnight-cat": {
    label: "Midnight Cat",
    species: "Cat",
    petName: "Luna",
    baseColor: "#343044",
    markingColor: "#E8D6F5",
    collarColor: "#6C8CD5",
    markingStyle: "mask",
  },
  "cream-tabby": {
    label: "Cream Tabby",
    species: "Cat",
    petName: "Miso",
    baseColor: "#DDAA67",
    markingColor: "#8E6846",
    collarColor: "#6D8B55",
    markingStyle: "freckles",
  },
} as const;

export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: CURRENT_SCHEMA,
  ownerName: "",
  petName: BREED_PRESETS["shiba-inu"].petName,
  pinnedNote: "",
  scheduledMessage: {
    enabled: false,
    at: "",
    text: "",
  },
  stretchEnabled: true,
  stretchEveryMinutes: 50,
  waterEnabled: true,
  waterEveryMinutes: 40,
  playRequestEnabled: true,
  playRequestMinutes: 30,
  quietFrom: null,
  quietTo: null,
  pomodoro: DEFAULT_POMODORO,
  soundEnabled: true,
  soundVolume: .8,
  reducedMotion: false,
  startAtLogin: false,
  inputMonitoringEnabled: false,
  notificationsEnabled: false,
  onboardingComplete: false,
  peekMode: false,
  alwaysOnTop: true,
  appearance: {
    breed: "shiba-inu",
    baseColor: BREED_PRESETS["shiba-inu"].baseColor,
    markingColor: BREED_PRESETS["shiba-inu"].markingColor,
    collarColor: BREED_PRESETS["shiba-inu"].collarColor,
    markingStyle: BREED_PRESETS["shiba-inu"].markingStyle,
    scale: 1,
    opacity: 1,
  },
};

/**
 * Merge whatever we loaded from disk on top of the defaults. Anything missing
 * or corrupt falls back to a sensible value, so a hand-edited or half-written
 * file can never crash the app — it just loses the bad field.
 */
export function normaliseSettings(raw: unknown): Settings {
  if (typeof raw !== "object" || raw === null) return { ...DEFAULT_SETTINGS };
  const r = raw as Record<string, unknown>;

  const num = (v: unknown, fallback: number, min = 0, max = Infinity) =>
    typeof v === "number" && Number.isFinite(v) ? clamp(v, min, max) : fallback;
  const str = (v: unknown, fallback: string) => (typeof v === "string" ? v : fallback);
  const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
  const hour = (v: unknown) => (typeof v === "number" && v >= 0 && v <= 23 ? Math.floor(v) : null);

  const d = DEFAULT_SETTINGS;
  const ap = (r.appearance ?? {}) as Record<string, unknown>;
  const pm = (r.pomodoro ?? {}) as Record<string, unknown>;
  const msg = (r.scheduledMessage ?? {}) as Record<string, unknown>;

  return {
    schemaVersion: CURRENT_SCHEMA,
    ownerName: str(r.ownerName, d.ownerName).slice(0, 40),
    petName: str(r.petName, d.petName).slice(0, 40) || d.petName,
    pinnedNote: str(r.pinnedNote, d.pinnedNote).slice(0, 120),
    scheduledMessage: {
      enabled: bool(msg.enabled, d.scheduledMessage.enabled),
      at: datetimeLocal(msg.at, d.scheduledMessage.at),
      text: str(msg.text, d.scheduledMessage.text).slice(0, 120),
    },
    stretchEnabled: bool(r.stretchEnabled, d.stretchEnabled),
    stretchEveryMinutes: num(r.stretchEveryMinutes, d.stretchEveryMinutes, 1, 1440),
    waterEnabled: bool(r.waterEnabled, d.waterEnabled),
    waterEveryMinutes: num(r.waterEveryMinutes, d.waterEveryMinutes, 1, 1440),
    playRequestEnabled: bool(r.playRequestEnabled, d.playRequestEnabled),
    playRequestMinutes: num(r.playRequestMinutes, d.playRequestMinutes, 5, 240),
    quietFrom: hour(r.quietFrom),
    quietTo: hour(r.quietTo),
    pomodoro: {
      focusMinutes: num(pm.focusMinutes, d.pomodoro.focusMinutes, 1, 180),
      breakMinutes: num(pm.breakMinutes, d.pomodoro.breakMinutes, 1, 60),
      longBreakMinutes: num(pm.longBreakMinutes, d.pomodoro.longBreakMinutes, 1, 120),
      roundsBeforeLongBreak: num(pm.roundsBeforeLongBreak, d.pomodoro.roundsBeforeLongBreak, 1, 12),
    },
    soundEnabled: bool(r.soundEnabled, d.soundEnabled),
    soundVolume: num(r.soundVolume, d.soundVolume, 0.1, 1),
    reducedMotion: bool(r.reducedMotion, d.reducedMotion),
    startAtLogin: bool(r.startAtLogin, d.startAtLogin),
    inputMonitoringEnabled: bool(r.inputMonitoringEnabled, d.inputMonitoringEnabled),
    notificationsEnabled: bool(r.notificationsEnabled, d.notificationsEnabled),
    onboardingComplete: bool(r.onboardingComplete, d.onboardingComplete),
    peekMode: bool(r.peekMode, d.peekMode),
    alwaysOnTop: bool(r.alwaysOnTop, d.alwaysOnTop),
    appearance: {
      breed: breedId(ap.breed, d.appearance.breed),
      baseColor: hex(ap.baseColor, d.appearance.baseColor),
      markingColor: hex(ap.markingColor, d.appearance.markingColor),
      collarColor: hex(ap.collarColor, d.appearance.collarColor),
      markingStyle: markingStyle(ap.markingStyle, d.appearance.markingStyle),
      scale: num(ap.scale, d.appearance.scale, 0.65, 2),
      opacity: num(ap.opacity, d.appearance.opacity, 0.5, 1),
    },
  };
}

/**
 * Fill a reminder template with the owner's name. ComNyang's "tell your name"
 * feature. `{name}` is replaced; if no name is set, we fall back gracefully so
 * it never reads "time to stretch, !".
 */
export function personalise(template: string, ownerName: string): string {
  if (ownerName.trim() === "") {
    // Drop a leading "{name}, " and keep the rest, else swap the token for a friendly word.
    return template
      .replace(/^\{name\},?\s*/i, "")
      .replace(/\{name\}/gi, "friend")
      .trim();
  }
  return template.replace(/\{name\}/gi, ownerName.trim());
}

/** The default reminder lines. Kept here so the whole voice of the app is in one place. */
export const REMINDER_TEXT = {
  stretch: "{name}, time to stretch! Stand up and reach for the sky.",
  water:   "{name}, hydration break — go grab some water.",
  focusDone: "Nice focus, {name}! Take a breather.",
  breakDone: "Break's over, {name}. Let's get back to it.",
} as const;

function clamp(n: number, lo: number, hi: number) {
  return n < lo ? lo : n > hi ? hi : n;
}

function hex(v: unknown, fallback: string): string {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback;
}

function breedId(v: unknown, fallback: string): string {
  return typeof v === "string" && (BUILT_IN_BREEDS as readonly string[]).includes(v) ? v : fallback;
}

function markingStyle(v: unknown, fallback: string): string {
  return typeof v === "string" && ["classic", "mask", "patch", "freckles"].includes(v) ? v : fallback;
}

function datetimeLocal(v: unknown, fallback: string): string {
  if (typeof v !== "string" || v === "") return fallback;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return fallback;
  return Number.isNaN(Date.parse(v)) ? fallback : v;
}
