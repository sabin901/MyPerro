/**
 * Settings storage bridge.
 *
 * In the native app this calls Rust, which persists one JSON file in the OS
 * config directory. In a browser-only demo/dev page, it falls back to
 * localStorage so the settings window can still be exercised without Tauri.
 */

import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";

import { normaliseSettings, type Settings } from "./settings";

const FALLBACK_KEY = "myperro.settings.v1";
const isNative = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

function hasLocalStorage(): boolean {
  try {
    return typeof localStorage !== "undefined";
  } catch {
    return false;
  }
}

function loadFallback(): Settings {
  if (!hasLocalStorage()) return normaliseSettings(null);
  const text = localStorage.getItem(FALLBACK_KEY);
  if (text === null) return normaliseSettings(null);
  try {
    return normaliseSettings(JSON.parse(text));
  } catch {
    return normaliseSettings(null);
  }
}

function saveFallback(settings: Settings): Settings {
  const clean = normaliseSettings(settings);
  if (hasLocalStorage()) {
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(clean));
  }
  return clean;
}

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await invoke<unknown>("load_settings");
    return normaliseSettings(raw);
  } catch (error) {
    if (isNative()) throw error;
    return loadFallback();
  }
}

export async function saveSettings(settings: Settings): Promise<Settings> {
  const clean = normaliseSettings(settings);
  try {
    await invoke("save_settings", { settings: clean });
  } catch (error) {
    if (isNative()) throw error;
    const saved = saveFallback(clean);
    await emit("settings-updated", saved).catch(() => {});
    return saved;
  }
  await emit("settings-updated", clean).catch(() => {});
  return clean;
}
