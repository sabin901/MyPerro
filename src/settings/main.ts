/**
 * Settings window logic.
 *
 * Reads the saved settings, fills the form, and writes them back on save. The
 * validation lives in settings.ts (`normaliseSettings`), so this file only has
 * to move values between the DOM and the object — it never has to trust them.
 */

import { loadSettings, saveSettings } from "../pet/store";
import { BREED_PRESETS, BUILT_IN_BREEDS, normaliseSettings, type Settings } from "../pet/settings";
import { emit, listen } from "@tauri-apps/api/event";
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isPermissionGranted, requestPermission } from "@tauri-apps/plugin-notification";
import { error as logError, info as logInfo } from "@tauri-apps/plugin-log";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import {
  applyCare, loadNeeds, moodMessage, petMood, saveNeeds, wellbeingScore,
  type CareAction, type PetNeeds,
} from "../pet/needs";
import { playCompanionSound } from "../pet/audio";
import { companionPersonality } from "../pet/personality";

const $ = <T extends HTMLElement = HTMLInputElement>(id: string) =>
  document.getElementById(id) as T;
const preview = $("breedPreview") as HTMLCanvasElement;
const pctx = preview.getContext("2d", { alpha: true })!;
pctx.imageSmoothingEnabled = false;
let previewRun = 0;
let currentNeeds: PetNeeds;
let feedbackTimer: ReturnType<typeof setTimeout> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let onboardingComplete = false;

interface InputHealth {
  status: "disabled" | "starting" | "active" | "unavailable";
  summary: string;
  guidance: string;
}

interface UsageResult {
  status: "disabled" | "not_configured" | "throttled" | "sent" | "deleted";
  nextAllowedAt?: number | null;
}

/** Read a form field, tolerating blanks. */
const text = (id: string) => ($(id) as HTMLInputElement).value;
const int = (id: string) => {
  const v = ($(id) as HTMLInputElement).value.trim();
  return v === "" ? null : Number(v);
};
const checked = (id: string) => ($(id) as HTMLInputElement).checked;

function fill(s: Settings) {
  ($("ownerName") as HTMLInputElement).value = s.ownerName;
  ($("petName") as HTMLInputElement).value = s.petName;
  ($("pinnedNote") as HTMLInputElement).value = s.pinnedNote;
  ($("messageEnabled") as HTMLInputElement).checked = s.scheduledMessage.enabled;
  ($("messageAt") as HTMLInputElement).value = s.scheduledMessage.at;
  ($("messageText") as HTMLInputElement).value = s.scheduledMessage.text;

  ($("stretchEnabled") as HTMLInputElement).checked = s.stretchEnabled;
  ($("stretchEveryMinutes") as HTMLInputElement).value = String(s.stretchEveryMinutes);
  ($("waterEnabled") as HTMLInputElement).checked = s.waterEnabled;
  ($("waterEveryMinutes") as HTMLInputElement).value = String(s.waterEveryMinutes);
  ($("playRequestEnabled") as HTMLInputElement).checked = s.playRequestEnabled;
  ($("playRequestMinutes") as HTMLInputElement).value = String(s.playRequestMinutes);
  ($("quietFrom") as HTMLInputElement).value = s.quietFrom === null ? "" : String(s.quietFrom);
  ($("quietTo") as HTMLInputElement).value = s.quietTo === null ? "" : String(s.quietTo);

  ($("focusMinutes") as HTMLInputElement).value = String(s.pomodoro.focusMinutes);
  ($("breakMinutes") as HTMLInputElement).value = String(s.pomodoro.breakMinutes);
  ($("longBreakMinutes") as HTMLInputElement).value = String(s.pomodoro.longBreakMinutes);
  ($("roundsBeforeLongBreak") as HTMLInputElement).value = String(s.pomodoro.roundsBeforeLongBreak);

  ($("breed") as HTMLSelectElement).value = s.appearance.breed;
  ($("baseColor") as HTMLInputElement).value = s.appearance.baseColor;
  ($("markingColor") as HTMLInputElement).value = s.appearance.markingColor;
  ($("markingStyle") as HTMLSelectElement).value = s.appearance.markingStyle;
  ($("collarColor") as HTMLInputElement).value = s.appearance.collarColor;
  ($("petScale") as HTMLInputElement).value = String(Math.round(s.appearance.scale * 100));
  $("petScaleValue").textContent = `${Math.round(s.appearance.scale * 100)}%`;
  ($("petOpacity") as HTMLInputElement).value = String(Math.round(s.appearance.opacity * 100));
  $("petOpacityValue").textContent = `${Math.round(s.appearance.opacity * 100)}%`;

  ($("soundEnabled") as HTMLInputElement).checked = s.soundEnabled;
  ($("soundVolume") as HTMLInputElement).value = String(Math.round(s.soundVolume * 100));
  $("soundVolumeValue").textContent = `${Math.round(s.soundVolume * 100)}%`;
  ($("peekMode") as HTMLInputElement).checked = s.peekMode;
  ($("alwaysOnTop") as HTMLInputElement).checked = s.alwaysOnTop;
  ($("reducedMotion") as HTMLInputElement).checked = s.reducedMotion;
  ($("startAtLogin") as HTMLInputElement).checked = s.startAtLogin;
  ($("inputMonitoringEnabled") as HTMLInputElement).checked = s.inputMonitoringEnabled;
  ($("notificationsEnabled") as HTMLInputElement).checked = s.notificationsEnabled;
  ($("anonymousUsageEnabled") as HTMLInputElement).checked = s.anonymousUsageEnabled;
  onboardingComplete = s.onboardingComplete;
  renderBreedCards(s.appearance.breed);
}

/** Gather the form into a raw object. normaliseSettings does the clamping. */
function collect(): Settings {
  return normaliseSettings({
    ownerName: text("ownerName"),
    petName: text("petName"),
    pinnedNote: text("pinnedNote"),
    scheduledMessage: {
      enabled: checked("messageEnabled"),
      at: text("messageAt"),
      text: text("messageText"),
    },
    stretchEnabled: checked("stretchEnabled"),
    stretchEveryMinutes: int("stretchEveryMinutes"),
    waterEnabled: checked("waterEnabled"),
    waterEveryMinutes: int("waterEveryMinutes"),
    playRequestEnabled: checked("playRequestEnabled"),
    playRequestMinutes: int("playRequestMinutes"),
    quietFrom: int("quietFrom"),
    quietTo: int("quietTo"),
    pomodoro: {
      focusMinutes: int("focusMinutes"),
      breakMinutes: int("breakMinutes"),
      longBreakMinutes: int("longBreakMinutes"),
      roundsBeforeLongBreak: int("roundsBeforeLongBreak"),
    },
    soundEnabled: checked("soundEnabled"),
    soundVolume: Number(text("soundVolume")) / 100,
    peekMode: checked("peekMode"),
    alwaysOnTop: checked("alwaysOnTop"),
    reducedMotion: checked("reducedMotion"),
    startAtLogin: checked("startAtLogin"),
    inputMonitoringEnabled: checked("inputMonitoringEnabled"),
    notificationsEnabled: checked("notificationsEnabled"),
    anonymousUsageEnabled: checked("anonymousUsageEnabled"),
    onboardingComplete,
    appearance: {
      breed: ($("breed") as HTMLSelectElement).value,
      baseColor: text("baseColor"),
      markingColor: text("markingColor"),
      markingStyle: ($("markingStyle") as HTMLSelectElement).value,
      collarColor: text("collarColor"),
      scale: Number(text("petScale")) / 100,
      opacity: Number(text("petOpacity")) / 100,
    },
  });
}

async function main() {
  await renderAppInfo();
  const loaded = await loadSettings();
  fill(loaded);
  wireTabs();
  wireOnboarding();
  wireAnonymousUsage();
  wireProductionControls();
  currentNeeds = loadNeeds();
  renderNeeds(currentNeeds);
  void drawPreview();
  if (!loaded.onboardingComplete) {
    ($("onboardingDialog") as HTMLDialogElement).showModal();
  }
  const closeSettings = async () => {
    await getCurrentWindow().setAlwaysOnTop(false).catch(() => {});
    await getCurrentWindow().hide();
    await emit("settings-closed");
  };
  $("doneSettings").addEventListener("click", () => { void closeSettings(); });
  await getCurrentWindow().onCloseRequested(async event => {
    event.preventDefault();
    await closeSettings();
  });

  await listen<PetNeeds>("needs-updated", e => {
    currentNeeds = e.payload;
    renderNeeds(currentNeeds);
  });
  document.querySelectorAll<HTMLButtonElement>("button[data-care]").forEach(button => {
    button.addEventListener("click", () => {
      const action = button.dataset.care as CareAction;
      currentNeeds = saveNeeds(applyCare(currentNeeds, action));
      renderNeeds(currentNeeds);
      showCareFeedback(action);
      void emit("care-action", action);
      button.disabled = true;
      setTimeout(() => { button.disabled = false; }, 500);
    });
  });
  document.querySelectorAll<HTMLButtonElement>("button[data-preview]").forEach(button => {
    button.addEventListener("click", () => {
      void emit("preview-action", button.dataset.preview!);
      button.disabled = true;
      setTimeout(() => { button.disabled = false; }, 450);
    });
  });

  for (const id of ["baseColor", "markingColor", "markingStyle", "collarColor"]) {
    $(id).addEventListener("input", () => { void drawPreview(); });
    $(id).addEventListener("change", () => { void drawPreview(); });
  }
  $("breed").addEventListener("input", () => applyBreed(($("breed") as HTMLSelectElement).value));
  $("breed").addEventListener("change", () => applyBreed(($("breed") as HTMLSelectElement).value));
  $("petOpacity").addEventListener("input", () => {
    $("petOpacityValue").textContent = `${text("petOpacity")}%`;
  });
  $("petScale").addEventListener("input", () => {
    $("petScaleValue").textContent = `${text("petScale")}%`;
  });
  $("soundVolume").addEventListener("input", () => {
    $("soundVolumeValue").textContent = `${text("soundVolume")}%`;
  });

  $("gentlePreset").addEventListener("click", () => setReminderPreset(true, 60, true, 45));
  $("focusPreset").addEventListener("click", () => setReminderPreset(true, 30, true, 25));
  $("remindersOff").addEventListener("click", () => setReminderPreset(false, 50, false, 40));
  $("classicPomodoro").addEventListener("click", () => setPomodoroPreset(25, 5, 15, 4));
  $("deepWorkPomodoro").addEventListener("click", () => setPomodoroPreset(50, 10, 25, 2));
  $("resetLook").addEventListener("click", () => applyBreed(($("breed") as HTMLSelectElement).value));
  $("surpriseCompanion").addEventListener("click", () => {
    const current = ($("breed") as HTMLSelectElement).value;
    const choices = BUILT_IN_BREEDS.filter(id => id !== current);
    applyBreed(choices[Math.floor(Math.random() * choices.length)]);
  });

  $("form").addEventListener("submit", async e => {
    e.preventDefault();
    await persistSettings(true);
  });
  $("form").addEventListener("input", queueAutoSave);
  $("form").addEventListener("change", queueAutoSave);
}

function wireOnboarding() {
  const dialog = $("onboardingDialog") as HTMLDialogElement;
  const finish = async (enable: boolean) => {
    onboardingComplete = true;
    ($("inputMonitoringEnabled") as HTMLInputElement).checked = enable;
    ($("anonymousUsageEnabled") as HTMLInputElement).checked = checked("onboardingUsageEnabled");
    if (enable) {
      await invoke<boolean>("enable_input_monitoring").catch(async error => {
        await logError(`Could not start input monitoring: ${String(error)}`).catch(() => {});
      });
    }
    await persistSettings(false);
    await syncAnonymousUsage();
    dialog.close();
    window.scrollTo({ top: 0, behavior: "auto" });
    await logInfo(`Onboarding completed; input reactions ${enable ? "enabled" : "disabled"}`).catch(() => {});
  };
  $("enableReactions").addEventListener("click", () => { void finish(true); });
  $("skipReactions").addEventListener("click", () => { void finish(false); });
  $("replayOnboarding").addEventListener("click", () => {
    ($("onboardingUsageEnabled") as HTMLInputElement).checked = checked("anonymousUsageEnabled");
    dialog.showModal();
  });

  const ua = navigator.userAgent.toLowerCase();
  $("onboardingPlatform").textContent = ua.includes("mac")
    ? "macOS will ask for Accessibility permission so Pawi can count activity while other apps are active."
    : ua.includes("linux")
      ? "Global reactions work on X11 and XWayland. Native Wayland may intentionally restrict them."
      : "Windows may ask your security software to allow the local activity listener.";
}

function wireAnonymousUsage() {
  $("anonymousUsageEnabled").addEventListener("change", () => { void syncAnonymousUsage(); });
  renderAnonymousUsageStatus(checked("anonymousUsageEnabled") ? "throttled" : "disabled");
  void syncAnonymousUsage();
}

async function syncAnonymousUsage() {
  const enabled = checked("anonymousUsageEnabled");
  renderAnonymousUsageStatus(enabled ? "throttled" : "disabled");
  try {
    const result = enabled
      ? await invoke<UsageResult>("send_usage_heartbeat", { enabled: true })
      : await invoke<UsageResult>("disable_usage_count");
    renderAnonymousUsageStatus(result.status);
  } catch (error) {
    $("anonymousUsageStatus").textContent = "Could not reach the counter. The app will retry later; no activity or personal content is included.";
    await logError(`Anonymous usage count failed: ${String(error)}`).catch(() => {});
  }
}

function renderAnonymousUsageStatus(status: UsageResult["status"]) {
  const copy: Record<UsageResult["status"], string> = {
    disabled: "Off. No usage heartbeat is sent.",
    not_configured: "Enabled locally, but this build has no counting service configured.",
    throttled: "On. The anonymous daily count is up to date.",
    sent: "On. This installation was counted anonymously today.",
    deleted: "Off. The anonymous identifier and server record were deleted.",
  };
  $("anonymousUsageStatus").textContent = copy[status];
}

function wireProductionControls() {
  $("livelyDefaults").addEventListener("click", () => {
    ($("soundEnabled") as HTMLInputElement).checked = true;
    ($("reducedMotion") as HTMLInputElement).checked = false;
    ($("peekMode") as HTMLInputElement).checked = false;
    const volume = $("soundVolume") as HTMLInputElement;
    volume.value = String(Math.max(80, Number(volume.value) || 80));
    $("soundVolumeValue").textContent = `${volume.value}%`;
    queueAutoSave();
    const badge = $("saved");
    badge.textContent = "Sound and full motion restored";
    badge.className = "saved show";
  });
  $("testSound").addEventListener("click", async () => {
    const button = $("testSound") as HTMLButtonElement;
    button.disabled = true;
    const profile = companionPersonality(($('breed') as HTMLSelectElement).value);
    const played = await playCompanionSound("happy", Number(text("soundVolume")) / 100, profile.voice).catch(() => false);
    const badge = $("saved");
    badge.textContent = played ? "Happy sound played" : "Sound is unavailable on this device";
    badge.className = played ? "saved" : "saved error";
    setTimeout(() => { button.disabled = false; }, 350);
  });
  $("inputMonitoringEnabled").addEventListener("change", async () => {
    if (checked("inputMonitoringEnabled")) {
      const started = await invoke<boolean>("enable_input_monitoring").catch(async error => {
        ($("inputMonitoringEnabled") as HTMLInputElement).checked = false;
        await logError(`Could not enable input monitoring: ${String(error)}`).catch(() => {});
        return false;
      });
      if (!started) {
        const badge = $("saved");
        badge.textContent = "Allow Pawi in Mac Accessibility to finish setup";
        badge.className = "saved error";
      }
    } else {
      await invoke("disable_input_monitoring").catch(async error => {
        await logError(`Could not disable input monitoring: ${String(error)}`).catch(() => {});
      });
    }
  });
  $("notificationsEnabled").addEventListener("change", async () => {
    if (!checked("notificationsEnabled")) return;
    let granted = await isPermissionGranted().catch(() => false);
    if (!granted) granted = (await requestPermission().catch(() => "denied")) === "granted";
    if (!granted) {
      ($("notificationsEnabled") as HTMLInputElement).checked = false;
      const badge = $("saved");
      badge.textContent = "Notifications were not allowed";
      badge.className = "saved error";
    }
  });
  $("exportDiagnostics").addEventListener("click", () => { void exportDiagnostics(); });
  $("checkUpdates").addEventListener("click", () => { void checkForUpdates(); });
  $("openInputPermission").addEventListener("click", () => { void invoke("open_input_permission_settings"); });
}

async function checkForUpdates() {
  const button = $("checkUpdates") as HTMLButtonElement;
  const status = $("updateStatus");
  let update: Awaited<ReturnType<typeof check>> = null;
  button.disabled = true;
  status.textContent = "Checking the signed release channel…";
  try {
    update = await check({ timeout: 15_000 });
    if (!update) {
      status.textContent = "Pawi is up to date.";
      return;
    }
    status.textContent = `Version ${update.version} is ready.`;
    if (!window.confirm(`Install Pawi ${update.version} now? The app will restart.`)) return;
    let downloaded = 0;
    let total = 0;
    await update.downloadAndInstall(event => {
      if (event.event === "Started") total = event.data.contentLength ?? 0;
      if (event.event === "Progress") downloaded += event.data.chunkLength;
      if (event.event === "Finished") status.textContent = "Update verified and installed. Restarting…";
      else if (total > 0) status.textContent = `Downloading update… ${Math.min(100, Math.round(downloaded / total * 100))}%`;
    });
    await update.close().catch(() => {});
    update = null;
    await relaunch();
  } catch (error) {
    status.textContent = "The update service is not available yet. Try again later.";
    await logError(`Update check failed: ${String(error)}`).catch(() => {});
  } finally {
    if (update) await update.close().catch(() => {});
    button.disabled = false;
  }
}

interface DiagnosticReport {
  app: string;
  version: string;
  author: string;
  os: string;
  architecture: string;
  configDirectory: string;
  logDirectory: string;
}

async function exportDiagnostics() {
  const button = $("exportDiagnostics") as HTMLButtonElement;
  button.disabled = true;
  try {
    const report = await invoke<DiagnosticReport>("diagnostic_report");
    const health = await invoke<InputHealth>("input_health").catch(() => null);
    const payload = {
      ...report,
      generatedAt: new Date().toISOString(),
      inputHealth: health,
      settingsSchema: collect().schemaVersion,
      runtime: readRuntimeDiagnostic(),
      note: "This report contains no keycodes, typed text, usernames, window titles, URLs, or application activity.",
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `pawi-diagnostics-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    const badge = $("saved");
    badge.textContent = "Diagnostics downloaded";
    badge.className = "saved";
  } catch (error) {
    await logError(`Diagnostic export failed: ${String(error)}`).catch(() => {});
    const badge = $("saved");
    badge.textContent = "Could not export diagnostics";
    badge.className = "saved error";
  } finally {
    button.disabled = false;
  }
}

function readRuntimeDiagnostic(): unknown {
  try {
    const value = localStorage.getItem("pawi.runtime-diagnostics.v1");
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

async function renderAppInfo() {
  try {
    $("appVersion").textContent = `Version ${await getVersion()}`;
  } catch {
    $("appVersion").textContent = "Desktop edition";
  }

  const userAgent = navigator.userAgent.toLowerCase();
  const platform = userAgent.includes("windows") ? "Windows" :
    userAgent.includes("mac") ? "macOS" : userAgent.includes("linux") ? "Linux" : "this platform";
  $("openInputPermission").hidden = platform !== "macOS";
  $("platformNote").textContent = platform === "Linux"
    ? "Linux support: X11 and XWayland are supported; native Wayland global input reactions depend on the compositor."
    : `${platform} desktop support is enabled in this build.`;

  const refresh = async () => {
    try {
      let health = await invoke<InputHealth>("input_health");
      if (platform === "macOS" && checked("inputMonitoringEnabled") && health.status === "unavailable") {
        await invoke<boolean>("retry_input_monitoring").catch(() => false);
        health = await invoke<InputHealth>("input_health");
      }
      $("inputDiagnostic").dataset.status = health.status;
      $("inputStatus").textContent = health.summary;
      $("inputGuidance").textContent = health.guidance;
    } catch {
      $("inputDiagnostic").dataset.status = "unavailable";
      $("inputStatus").textContent = "Compatibility check unavailable";
      $("inputGuidance").textContent = "Restart Pawi and open Settings again.";
    }
  };
  await refresh();
  window.setInterval(() => { void refresh(); }, 2500);
}

function wireTabs() {
  const buttons = [...document.querySelectorAll<HTMLButtonElement>("button[data-tab]")];
  const stored = localStorage.getItem("pawi.settings-tab")
    ?? localStorage.getItem("myperro.settings-tab");
  const initial = buttons.some(button => button.dataset.tab === stored) ? stored! : "home";
  const activate = (tab: string, animate = true) => {
    buttons.forEach(button => {
      const active = button.dataset.tab === tab;
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    });
    document.querySelectorAll<HTMLElement>("[data-pane]").forEach(pane => {
      pane.classList.toggle("pane-hidden", pane.dataset.pane !== tab);
      pane.setAttribute("role", "tabpanel");
      pane.setAttribute("aria-labelledby", `tab-${pane.dataset.pane}`);
    });
    localStorage.setItem("pawi.settings-tab", tab);
    window.scrollTo({ top: 0, behavior: animate ? "smooth" : "auto" });
  };
  buttons.forEach(button => button.addEventListener("click", () => activate(button.dataset.tab!)));
  buttons.forEach((button, index) => button.addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 :
      (index + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next].focus();
    activate(buttons[next].dataset.tab!);
  }));
  activate(initial, false);
}

function queueAutoSave() {
  const badge = $("saved");
  badge.textContent = "Saving…";
  badge.className = "saved saving";
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { void persistSettings(false); }, 500);
}

async function persistSettings(reflect: boolean) {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  const badge = $("saved");
  badge.textContent = "Saving…";
  badge.className = "saved saving";
  try {
    const saved = await saveSettings(collect());
    if (reflect) fill(saved);
    badge.textContent = "All changes saved";
    badge.className = "saved";
  } catch {
    badge.textContent = "Could not save — try again";
    badge.className = "saved error";
  }
}

function renderNeeds(needs: PetNeeds) {
  for (const key of ["hunger", "thirst", "happiness", "energy"] as const) {
    const value = Math.round(needs[key]);
    const meter = $(`${key}Meter`);
    meter.style.width = `${value}%`;
    meter.classList.toggle("low", value < 28);
    meter.parentElement?.setAttribute("aria-valuenow", String(value));
    const output = $(`${key}Value`) as HTMLOutputElement;
    output.value = `${value}%`;
    output.textContent = `${value}%`;
  }
  const mood = petMood(needs);
  const name = text("petName").trim() || "Your companion";
  const labels = { thriving: "Thriving", happy: "Happy", okay: "Doing okay", "needs-care": "Needs help" };
  $("moodTitle").textContent = labels[mood];
  $("moodMessage").textContent = moodMessage(mood, name);
  const badge = $("moodBadge");
  badge.textContent = `${wellbeingScore(needs)}%`;
  badge.dataset.mood = mood;
}

function showCareFeedback(action: CareAction) {
  const name = text("petName").trim() || "Your companion";
  const messages: Record<CareAction, string> = {
    feed: `${name} enjoyed the snack.`, water: `${name} feels refreshed.`,
    play: `${name} loved playing with you!`, rest: `${name} is getting cozy.`,
  };
  const feedback = $("careFeedback");
  feedback.textContent = messages[action];
  if (feedbackTimer) clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(() => { feedback.textContent = ""; }, 2600);
}

main();

function renderBreedCards(activeBreed: string) {
  const host = $("breedCards");
  host.innerHTML = "";
  for (const [id, preset] of Object.entries(BREED_PRESETS)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `breed-card${id === activeBreed ? " active" : ""}`;
    button.dataset.breed = id;
    const profile = companionPersonality(id);
    button.innerHTML = `<em>${preset.species}</em><strong>${preset.label}</strong><small>${profile.nature}</small>`;
    button.addEventListener("click", () => applyBreed(id));
    host.appendChild(button);
  }
}

function setReminderPreset(stretchOn: boolean, stretchMinutes: number, waterOn: boolean, waterMinutes: number) {
  ($("stretchEnabled") as HTMLInputElement).checked = stretchOn;
  ($("stretchEveryMinutes") as HTMLInputElement).value = String(stretchMinutes);
  ($("waterEnabled") as HTMLInputElement).checked = waterOn;
  ($("waterEveryMinutes") as HTMLInputElement).value = String(waterMinutes);
  queueAutoSave();
}

function setPomodoroPreset(focus: number, shortBreak: number, longBreak: number, rounds: number) {
  ($("focusMinutes") as HTMLInputElement).value = String(focus);
  ($("breakMinutes") as HTMLInputElement).value = String(shortBreak);
  ($("longBreakMinutes") as HTMLInputElement).value = String(longBreak);
  ($("roundsBeforeLongBreak") as HTMLInputElement).value = String(rounds);
  queueAutoSave();
}

function applyBreed(id: string) {
  const preset = BREED_PRESETS[id as keyof typeof BREED_PRESETS];
  if (!preset) return;
  ($("breed") as HTMLSelectElement).value = id;
  ($("petName") as HTMLInputElement).value = preset.petName;
  ($("baseColor") as HTMLInputElement).value = preset.baseColor;
  ($("markingColor") as HTMLInputElement).value = preset.markingColor;
  ($("markingStyle") as HTMLSelectElement).value = preset.markingStyle;
  ($("collarColor") as HTMLInputElement).value = preset.collarColor;
  renderBreedCards(id);
  void drawPreview();
  queueAutoSave();
}

async function drawPreview() {
  const run = ++previewRun;
  const settings = collect();
  const breed = settings.appearance.breed;
  pctx.clearRect(0, 0, preview.width, preview.height);
  let atlas: { frames?: { idle?: { x: number; y: number; w: number; h: number } } } | null = null;
  let img: HTMLImageElement | null = null;
  try {
    [atlas, img] = await Promise.all([
      fetch(`/exported/${breed}/atlas.json`).then(r => {
        if (!r.ok) throw new Error(`preview metadata returned ${r.status}`);
        return r.json();
      }),
      loadImage(`/exported/${breed}/atlas.png`),
    ]);
  } catch (error) {
    await logError(`Could not load ${breed} preview: ${String(error)}`).catch(() => {});
    try {
      [atlas, img] = await Promise.all([
        fetch("/placeholder/shiba_placeholder.json").then(r => r.json()),
        loadImage("/placeholder/shiba_placeholder.png"),
      ]);
    } catch (fallbackError) {
      await logError(`Preview fallback failed: ${String(fallbackError)}`).catch(() => {});
    }
  }
  if (run !== previewRun) return;
  const frame = atlas?.frames?.idle;
  if (!frame || !img) {
    preview.setAttribute("aria-label", "Companion preview unavailable");
    return;
  }
  pctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);
  preview.setAttribute("aria-label", `Preview of ${BREED_PRESETS[breed as keyof typeof BREED_PRESETS]?.label ?? "your companion"}`);
  recolourPreview(settings);
  drawPreviewMarking(settings.appearance.markingColor, settings.appearance.markingStyle);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${src}`));
    img.src = src;
  });
}

function drawPreviewMarking(markingColor: string, markingStyle: string) {
  if (markingStyle === "classic") return;
  pctx.fillStyle = markingColor;
  const breed = ($("breed") as HTMLSelectElement).value;
  if (breed.endsWith("-cat")) {
    if (markingStyle === "mask") {
      pctx.fillRect(55, 35, 7, 5);
      pctx.fillRect(70, 35, 7, 5);
      pctx.fillRect(62, 38, 5, 2);
    } else if (markingStyle === "patch") {
      pctx.fillRect(72, 32, 8, 10);
      pctx.fillRect(54, 42, 7, 5);
      pctx.fillRect(42, 57, 10, 6);
    } else if (markingStyle === "freckles") {
      for (const [x, y] of [[57, 48], [62, 50], [73, 48], [78, 51], [45, 59]]) {
        pctx.fillRect(x, y, 2, 2);
      }
    }
    return;
  }

  if (markingStyle === "mask") {
    pctx.fillRect(54, 35, 8, 5);
    pctx.fillRect(70, 35, 8, 5);
    pctx.fillRect(62, 39, 4, 3);
  } else if (markingStyle === "patch") {
    pctx.fillRect(70, 33, 8, 9);
    pctx.fillRect(72, 42, 5, 3);
    pctx.fillRect(42, 53, 10, 7);
  } else if (markingStyle === "freckles") {
    for (const [x, y] of [[57, 47], [62, 49], [74, 47], [78, 50], [46, 58]]) {
      pctx.fillRect(x, y, 2, 2);
    }
  }
}

function recolourPreview(settings: Settings) {
  const image = pctx.getImageData(0, 0, preview.width, preview.height);
  const data = image.data;
  const base = parseHex(settings.appearance.baseColor);
  const marking = parseHex(settings.appearance.markingColor);
  const collar = parseHex(settings.appearance.collarColor);

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const rgb = `${data[i]},${data[i + 1]},${data[i + 2]}`;
    if (BODY_DARK.has(rgb)) setRgb(data, i, shade(base, 0.72));
    else if (BODY_MID.has(rgb)) setRgb(data, i, shade(base, 1));
    else if (BODY_LIGHT.has(rgb)) setRgb(data, i, shade(base, 1.18));
    else if (MARK_MID.has(rgb)) setRgb(data, i, shade(marking, 1));
    else if (MARK_DARK.has(rgb)) setRgb(data, i, shade(marking, 0.82));
    else if (rgb === "198,49,48") setRgb(data, i, collar);
  }
  pctx.putImageData(image, 0, 0);
}

const BODY_DARK = new Set([
  "145,84,37", "159,104,59", "69,80,92", "132,86,40", "168,168,158", "137,111,76",
  "189,163,126", "35,32,48", "159,112,67",
]);
const BODY_MID = new Set([
  "201,116,52", "221,145,82", "96,111,128", "183,119,55", "234,233,220", "190,154,105",
  "247,229,197", "52,48,68", "221,170,103",
]);
const BODY_LIGHT = new Set([
  "230,151,75", "245,182,105", "132,151,168", "218,156,79", "255,251,232", "226,196,143",
  "255,241,212", "78,72,98", "245,199,128",
]);
const MARK_MID = new Set([
  "248,219,166", "255,225,172", "239,244,240", "61,52,43", "54,52,49", "245,226,184",
  "200,117,67", "232,214,245", "142,104,70",
]);
const MARK_DARK = new Set([
  "203,180,136", "209,185,141", "196,200,197", "50,43,35", "44,43,40", "201,185,151",
  "153,82,48", "184,166,205", "107,76,51",
]);

function parseHex(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function shade(rgb: [number, number, number], amount: number): [number, number, number] {
  return [
    Math.max(0, Math.min(255, Math.round(rgb[0] * amount))),
    Math.max(0, Math.min(255, Math.round(rgb[1] * amount))),
    Math.max(0, Math.min(255, Math.round(rgb[2] * amount))),
  ];
}

function setRgb(data: Uint8ClampedArray, i: number, rgb: [number, number, number]) {
  data[i] = rgb[0];
  data[i + 1] = rgb[1];
  data[i + 2] = rgb[2];
}
