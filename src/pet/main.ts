/**
 * MyPerro — pet window renderer.
 *
 * Glue only. Every decision lives in engine.ts, every coordinate conversion in
 * coords.ts, and both are unit tested. This file owns the canvas, the Tauri
 * calls, and nothing else.
 */

import { currentMonitor, getCurrentWindow, monitorFromPoint } from "@tauri-apps/api/window";
import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";
import { emit, listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import {
  isPermissionGranted,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { error as logError, info as logInfo, warn as logWarn } from "@tauri-apps/plugin-log";

import { FPS, shouldDraw, isDegraded, keysPerSecond, THRESHOLDS, type Mode } from "./behaviour";
import {
  BehaviourEngine, SustainedDetector, ReversalDetector,
  type Signals, type ReminderKind, type AgentEvent,
} from "./engine";
import {
  globalToSprite, windowSize, windowCentre, normaliseVelocity,
  physicalToLogical, clampToMonitor, type Viewport,
} from "./coords";
import {
  makeRepeating, startPomodoro, stopPomodoro, pollScheduler,
  type SchedulerState,
} from "./scheduler";
import { idleLifeFrame } from "./idleLife";
import { attentionMove } from "./attention";
import { animatedCel } from "./animation";
import {
  PLAY_REQUEST_BARK_INTERVAL_MS, PLAY_REQUEST_DURATION_MS, REST_DURATION_MS,
  normaliseInteractionState, shouldRequestPlay, type CompanionInteractionState,
} from "./interaction";
import {
  applyCare, loadNeeds, mostUrgentNeed, saveNeeds, wellbeingScore,
  type CareAction, type PetNeeds,
} from "./needs";
import { PET_SHORTCUT_LABEL, petShortcutForKey } from "./shortcuts";
import {
  careSound, playCompanionSound, unlockCompanionAudio,
  type CompanionSoundName,
} from "./audio";
import { loadSettings } from "./store";
import { DEFAULT_SETTINGS, personalise, REMINDER_TEXT, type Settings } from "./settings";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Frame { x: number; y: number; w: number; h: number; index: number }
interface Atlas {
  canvas: { width: number; height: number };
  grid: { cols: number; rows: number };
  displayScale?: number;
  artStyle?: string;
  landmarks?: { eyes?: Array<{ x: number; y: number }> };
  frames: Record<string, Frame>;
}

/** Emitted by Rust. No keycodes — counts and geometry only. */
interface Activity {
  cursor_x: number;
  cursor_y: number;
  cursor_velocity: number;
  keys_since_last: number;
  clicks_since_last: number;
  scroll_delta: number;
  idle_ms: number;
  batch_ms: number;
}

interface AgentStatusFile {
  status: AgentEvent | "idle";
  message?: string;
  updatedAt?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DISPLAY_SCALE = 2;               // plan §9.3. Integer only.
const FALLBACK_ATLAS_URL = "/placeholder/shiba_placeholder.png";
const FALLBACK_META_URL  = "/placeholder/shiba_placeholder.json";
const HIT_ALPHA = 8;
const MESSAGE_DURATION_MS = 20_000;
const INTERACTION_STORAGE_KEY = "myperro.companion-interaction.v1";

/** Head occupies roughly the top 45% of the cell — used for petting. */
const HEAD_FRACTION = 0.45;
const SCROLL_ACTIVE = 40;
const EYELESS_FRAMES = new Set(["blink", "sleep", "wake", "yawn", "pet_happy"]);

// ─── State ────────────────────────────────────────────────────────────────────

const win = getCurrentWindow();
const canvas = document.getElementById("pet") as HTMLCanvasElement;
const ctx = canvas.getContext("2d", { alpha: true })!;
const hudEl = document.getElementById("hud")!;
const noteEl = document.getElementById("note")!;
const clockEl = document.getElementById("clock")!;

let atlas: Atlas;
let sourceSheet: HTMLImageElement;
let sheet: HTMLImageElement | HTMLCanvasElement;
let hitMask: Uint8Array;
let maskW = 0;
let available: Set<string> = new Set();

let engine: BehaviourEngine;
const chaseDetector   = new SustainedDetector(200);            // plan §13.3
const pettingDetector = new ReversalDetector(1500, 3, 3);      // 3 strokes / 1.5s
const shakeDetector   = new ReversalDetector(800, 3, 6);       // 3 reversals / 0.8s

let viewport: Viewport = {
  winX: 0, winY: 0, scaleFactor: 1, displayScale: DISPLAY_SCALE, cell: 96,
};

let currentFrame = "idle";
let visibleFrame = "idle";
let mode: Mode = "idle";
let facingLeft = false;
let dragging = false;
let ignoringCursor = true;
let wasAsleep = false;
let peekMode = false;
let peekTimer: ReturnType<typeof setTimeout> | null = null;
let quietMode = false;
let beforePeekPosition: { x: number; y: number } | null = null;
let lastAutoWanderAt = 0;
let lastAttentionMoveAt = 0;
let wanderUntil = 0;
let playUntil = 0;
let careUntil = 0;
let careFrame = "idle";
let careFrameStartedAt = 0;
let careSequenceRun = 0;
let needs: PetNeeds;
let interactionState: CompanionInteractionState;
let playRequestUntil = 0;
let playRequestBarkTimer: ReturnType<typeof setInterval> | null = null;
let playRequestEndTimer: ReturnType<typeof setTimeout> | null = null;
let restUntil = 0;
let restTimer: ReturnType<typeof setTimeout> | null = null;
let lastNeedRequest = "";
let lastNeedRequestAt = 0;

let lastActivity: Activity | null = null;
let lastActivityAt = 0;
let degraded = false;
let reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/** Driven by the scheduler each second. */
let pendingReminder: ReminderKind | null = null;
let pendingAgentEvent: AgentEvent | null = null;
let lastAgentStatusSignature = "";

let settings: Settings;
let scheduler: SchedulerState;
let notificationsGranted = false;

let frames = 0, lastFpsAt = performance.now(), fps = 0, eventCount = 0, eventRate = 0;

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function boot() {
  settings = await loadSettings();
  needs = loadNeeds();
  interactionState = loadInteractionState();
  wirePetOnlyControls();
  await loadBreedAtlas(settings);
  await syncWindowGeometry();
  await win.setAlwaysOnTop(settings.alwaysOnTop);

  reducedMotion = reducedMotion || settings.reducedMotion;
  scheduler = buildScheduler(settings, performance.now());
  notificationsGranted = settings.notificationsEnabled
    ? await isPermissionGranted().catch(() => false)
    : false;
  applyPinnedNote();
  peekMode = false;
  setInterval(pollReminders, 1000);   // the scheduler ticks once a second
  setInterval(pollAgentStatus, 1000);
  setInterval(autoWander, 2000);
  setInterval(pollCompanionInteraction, 5000);
  setInterval(updateVirtualPet, 60_000);

  engine = new BehaviourEngine(performance.now());

  await listen<Activity>("activity", e => {
    lastActivity = e.payload;
    lastActivityAt = performance.now();
    eventCount++;
    onActivity(e.payload);
  });
  await listen<Settings>("settings-updated", e => {
    void applySettings(e.payload);
  });
  await listen("settings-closed", () => {
    void (async () => {
      await win.show();
      await win.setAlwaysOnTop(settings.alwaysOnTop);
      await syncWindowGeometry();
      await win.setFocus();
      canvas.focus({ preventScroll: true });
    })();
  });
  await listen("pomodoro-toggle", () => {
    togglePomodoro();
  });
  await listen("peek-toggle", () => {
    void togglePeekMode();
  });
  await listen("quiet-toggle", () => {
    toggleQuietMode();
  });
  await listen("play-toggle", () => {
    triggerPlay();
    handleCare("play");
  });
  await listen<CareAction>("care-action", e => handleCare(e.payload));
  await listen<string>("preview-action", e => previewAction(e.payload));

  wireDrag();
  wireHud();
  startDegradedWatchdog();
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      pollReminders();
      void syncWindowGeometry();
    }
  });
  window.addEventListener("focus", () => pollReminders());
  requestAnimationFrame(loop);
  updateVirtualPet();
  await logInfo(`Pet ready with companion pack ${settings.appearance.breed}`).catch(() => {});
}

function handleCare(action: CareAction) {
  const run = ++careSequenceRun;
  if (action !== "rest" && restUntil > performance.now()) endTimedRest(false);
  needs = saveNeeds(applyCare(needs, action));
  if (action === "feed" || action === "play") comfortCompanion();
  const cat = settings.appearance.breed.endsWith("-cat");
  playSound(careSound(action, cat ? "cat" : "dog"));
  if (action === "rest") {
    beginTimedRest();
    lastNeedRequest = "";
    flashNote("Zzz…", MESSAGE_DURATION_MS);
    broadcastNeeds();
    return;
  }
  const now = performance.now();
  const firstStageMs = action === "feed" ? 1900 : action === "water" ? 2100 : 3200;
  showCareFrame(action === "feed" ? "eat" : action === "water" ? "drink" :
    reducedMotion ? "tail_wag" : "zoomies", firstStageMs, now);
  lastNeedRequest = "";
  flashNote(action === "feed" ? "Nom nom!" : action === "water" ? "Slurp slurp!" :
    cat ? "Purr purr!" : "Woof woof!", 2400);
  if (action === "feed" || action === "water") {
    setTimeout(() => {
      if (run !== careSequenceRun || performance.now() < restUntil) return;
      showCareFrame(reducedMotion ? "tail_wag" : action === "feed" ? "happy_jump" : "shake",
        reducedMotion ? 1800 : 3000);
      flashNote(cat ? "Purr purr!" : "Woof woof!", 2600);
      playSound("happy");
    }, firstStageMs);
  }
  broadcastNeeds();
}

function showCareFrame(frame: string, durationMs: number, now = performance.now()) {
  careFrame = frame;
  careFrameStartedAt = now;
  careUntil = now + durationMs;
}

function showCareFrameUntil(frame: string, until: number) {
  careFrame = frame;
  careFrameStartedAt = performance.now();
  careUntil = until;
}

function loadInteractionState(): CompanionInteractionState {
  try {
    const raw = localStorage.getItem(INTERACTION_STORAGE_KEY);
    return normaliseInteractionState(raw ? JSON.parse(raw) : null);
  } catch {
    return normaliseInteractionState(null);
  }
}

function saveInteractionState() {
  try { localStorage.setItem(INTERACTION_STORAGE_KEY, JSON.stringify(interactionState)); }
  catch { /* interaction timing is allowed to degrade without breaking the pet */ }
}

function comfortCompanion() {
  interactionState.lastComfortAt = Date.now();
  saveInteractionState();
  stopPlayRequest(true);
}

function pollCompanionInteraction() {
  const now = Date.now();
  if (playRequestUntil > 0 && performance.now() >= playRequestUntil) stopPlayRequest(false);
  if (!shouldRequestPlay(
    interactionState,
    now,
    settings.playRequestMinutes,
    settings.playRequestEnabled,
    quietMode,
  )) return;
  beginPlayRequest(now);
}

function beginPlayRequest(now: number) {
  if (playRequestUntil > performance.now()) return;
  interactionState.lastRequestAt = now;
  saveInteractionState();
  const cat = settings.appearance.breed.endsWith("-cat");
  const call = cat ? "Meow meow!" : "Woof woof!";
  const sound = cat ? "purr" : "bark";
  playRequestUntil = performance.now() + PLAY_REQUEST_DURATION_MS;
  showCareFrameUntil("beg", playRequestUntil);
  flashNote(call, PLAY_REQUEST_DURATION_MS);
  playSound(sound);
  playRequestBarkTimer = setInterval(() => {
    if (quietMode || performance.now() >= playRequestUntil) return;
    playSound(sound);
  }, PLAY_REQUEST_BARK_INTERVAL_MS);
  playRequestEndTimer = setTimeout(() => stopPlayRequest(false), PLAY_REQUEST_DURATION_MS);
}

function stopPlayRequest(dismissMessage: boolean) {
  if (playRequestBarkTimer) clearInterval(playRequestBarkTimer);
  if (playRequestEndTimer) clearTimeout(playRequestEndTimer);
  playRequestBarkTimer = null;
  playRequestEndTimer = null;
  const wasActive = playRequestUntil > 0;
  playRequestUntil = 0;
  if (wasActive && careFrame === "beg") careUntil = performance.now();
  if (wasActive && dismissMessage) dismissTransientNote();
}

function beginTimedRest() {
  if (restTimer) clearTimeout(restTimer);
  stopPlayRequest(true);
  restUntil = performance.now() + REST_DURATION_MS;
  showCareFrameUntil("sleep", restUntil);
  restTimer = setTimeout(() => endTimedRest(false), REST_DURATION_MS);
}

function endTimedRest(touched: boolean) {
  if (restUntil <= 0) return;
  if (restTimer) clearTimeout(restTimer);
  restTimer = null;
  restUntil = 0;
  showCareFrame("wake", 1800);
  playSound("wake");
  if (touched) {
    dismissTransientNote();
  }
}

function handlePetTouch() {
  careSequenceRun++;
  const waking = restUntil > performance.now();
  const soothing = playRequestUntil > performance.now();
  if (waking) endTimedRest(true);
  comfortCompanion();
  if (!waking) {
    showCareFrame("pet_happy", soothing ? 2200 : 1500);
    playSound(settings.appearance.breed.endsWith("-cat") ? "purr" : "yip");
  }
}

function updateVirtualPet() {
  const resting = engine?.state === "asleep" || performance.now() < restUntil;
  needs = saveNeeds(loadNeeds(Date.now(), resting));
  broadcastNeeds();
  const urgent = mostUrgentNeed(needs);
  if (!urgent) { lastNeedRequest = ""; return; }
  const now = Date.now();
  if (urgent === lastNeedRequest && now - lastNeedRequestAt < 20 * 60_000) return;
  lastNeedRequest = urgent;
  lastNeedRequestAt = now;
  const cat = settings.appearance.breed.endsWith("-cat");
  showCareFrame(urgent === "thirst" ? "drink" : urgent === "energy" ? "sleep" : "beg", 6000);
  flashNote(urgent === "thirst" ? "Slurp?" : urgent === "energy" ? "Zzz…" :
    cat ? "Meow meow!" : "Woof woof!", 6000);
  playSound(urgent === "energy" ? "sleepy" : cat ? "purr" : "yip");
}

function broadcastNeeds() {
  canvas.setAttribute(
    "aria-label",
    `${settings.petName}, animated desktop companion. Wellbeing ${wellbeingScore(needs)} percent. ${PET_SHORTCUT_LABEL}.`,
  );
  void emit("needs-updated", needs).catch(() => {});
}

function wirePetOnlyControls() {
  canvas.addEventListener("pointerdown", event => {
    canvas.focus({ preventScroll: true });
    void win.setFocus().catch(() => {});
    if (event.button === 0) handlePetTouch();
  });
  window.addEventListener("pointerdown", () => { void unlockAndFlushAudio(); }, { capture: true });
  window.addEventListener("keydown", event => {
    if (isEditableTarget(event.target)) return;
    const shortcut = petShortcutForKey(event);
    if (!shortcut) return;
    event.preventDefault();
    event.stopPropagation();
    if (shortcut === "settings") {
      void invoke("open_settings");
      return;
    }
    if (shortcut === "play") triggerPlay();
    handleCare(shortcut);
  });
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.matches("input, textarea, select");
}

const PREVIEW_FRAMES: Record<string, { frame: string; message: string; duration?: number }> = {
  look: { frame: "look_up", message: "Move your pointer—those eyes are watching." },
  drag: { frame: "drag", message: "Pick up your companion and give them a gentle wobble." },
  hunt: { frame: "run", message: "A fast pointer starts the chase!" },
  pet: { frame: "pet_happy", message: "Head pats are always welcome." },
  typing: { frame: "type_paw", message: "Typing paws reporting for duty." },
  overheat: { frame: "type_intense", message: "Too many keys! Cooling down…" },
  stretch: { frame: "stretch", message: "Time to stretch together." },
  drink: { frame: "drink", message: "Fresh water break." },
  scroll: { frame: "paper_unroll", message: "Your scrolling unrolls a tiny paper trail." },
  thinking: { frame: "head_tilt", message: "Thinking alongside your AI agent." },
  done: { frame: "happy_jump", message: "Task complete—celebration jump!" },
  focus: { frame: "focus_sit", message: "Focus mode keeps a tiny timer nearby." },
  reminder: { frame: "deliver_note", message: "A reminder arrives right on time." },
  sleep: { frame: "sleep", message: "Quiet time means a cozy nap.", duration: 6000 },
};
let previewRun = 0;

function previewAction(action: string) {
  const run = ++previewRun;
  if (action === "all") {
    const sequence = ["look", "drag", "hunt", "pet", "typing", "overheat", "stretch", "drink", "scroll", "thinking", "done", "focus", "reminder", "sleep"];
    sequence.forEach((name, index) => setTimeout(() => {
      if (previewRun !== run) return;
      showPreview(name, index === sequence.length - 1 ? 5000 : 2400);
    }, index * 2500));
    return;
  }
  showPreview(action);
}

function showPreview(action: string, duration?: number) {
  const preview = PREVIEW_FRAMES[action];
  if (!preview) return;
  const visibleFor = duration ?? preview.duration ?? 4200;
  showCareFrame(preview.frame, visibleFor);
  flashNote(preview.message, visibleFor);
}

async function loadBreedAtlas(s: Settings) {
  const breed = s.appearance.breed || "shiba-inu";
  try {
    const [meta, img] = await Promise.all([
      fetchJson<Atlas>(`/exported/${breed}/atlas.json`),
      loadImage(`/exported/${breed}/atlas.png`),
    ]);
    applyAtlas(meta, img, s);
  } catch {
    const [meta, img] = await Promise.all([
      fetchJson<Atlas>(FALLBACK_META_URL),
      loadImage(FALLBACK_ATLAS_URL),
    ]);
    applyAtlas(meta, img, s);
  }
}

function applyAtlas(meta: Atlas, img: HTMLImageElement, s: Settings) {
  atlas = meta;
  sourceSheet = img;
  sheet = recolourSheet(sourceSheet, s);
  available = new Set(Object.keys(atlas.frames));

  canvas.width = atlas.canvas.width;
  canvas.height = atlas.canvas.height;
  ctx.imageSmoothingEnabled = false;

  viewport = {
    ...viewport,
    cell: atlas.canvas.width,
    displayScale: (atlas.displayScale && atlas.displayScale > 0 ? atlas.displayScale : DISPLAY_SCALE)
      * s.appearance.scale,
  };
  const size = windowSize(viewport);
  canvas.style.width = `${size.x}px`;
  canvas.style.height = `${size.y}px`;
  canvas.style.opacity = String(s.appearance.opacity);

  buildHitMask();
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`could not load ${url}`);
  return response.json() as Promise<T>;
}

async function applySettings(next: Settings) {
  settings = next;
  if (!settings.soundEnabled) pendingSound = null;
  if (!settings.playRequestEnabled) stopPlayRequest(false);
  reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || settings.reducedMotion;
  await loadBreedAtlas(settings);
  await syncWindowGeometry();
  await win.setAlwaysOnTop(settings.alwaysOnTop);
  scheduler = buildScheduler(settings, performance.now());
  notificationsGranted = settings.notificationsEnabled
    ? await isPermissionGranted().catch(() => false)
    : false;
  applyPinnedNote();
  peekMode = false;
  await applyPeekMode(false);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error(`could not load ${src}`));
    i.src = src;
  });
}

/**
 * Temporary Phase 3 recolouring for the built-in atlases.
 *
 * The final pack pipeline will use indexed palettes and marking masks. The
 * generated built-ins already use a controlled palette, so we can tint known
 * body/marking/collar colours without touching eyes, outlines or props.
 */
function recolourSheet(img: HTMLImageElement, s: Settings): HTMLCanvasElement {
  const off = document.createElement("canvas");
  off.width = img.width;
  off.height = img.height;
  const octx = off.getContext("2d", { willReadFrequently: true })!;
  octx.drawImage(img, 0, 0);
  const customColours =
    s.appearance.baseColor !== DEFAULT_SETTINGS.appearance.baseColor ||
    s.appearance.markingColor !== DEFAULT_SETTINGS.appearance.markingColor ||
    s.appearance.collarColor !== DEFAULT_SETTINGS.appearance.collarColor;
  if (!customColours) return off;

  const image = octx.getImageData(0, 0, off.width, off.height);
  const data = image.data;
  const base = parseHex(s.appearance.baseColor);
  const marking = parseHex(s.appearance.markingColor);
  const collar = parseHex(s.appearance.collarColor);

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const rgb = `${r},${g},${b}`;
    if (BODY_DARK.has(rgb)) setRgb(data, i, shade(base, 0.72));
    else if (BODY_MID.has(rgb)) setRgb(data, i, shade(base, 1.0));
    else if (BODY_LIGHT.has(rgb)) setRgb(data, i, shade(base, 1.18));
    else if (MARK_MID.has(rgb)) setRgb(data, i, shade(marking, 1.0));
    else if (MARK_DARK.has(rgb)) setRgb(data, i, shade(marking, 0.82));
    else if (rgb === "198,49,48") setRgb(data, i, collar);
  }
  octx.putImageData(image, 0, 0);
  return off;
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
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return [217, 132, 60];
  const n = Number.parseInt(m[1], 16);
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

/** Cache the atlas alpha channel once — getImageData per pointer move would be ruinous. */
function buildHitMask() {
  const off = document.createElement("canvas");
  off.width = sheet.width; off.height = sheet.height;
  const octx = off.getContext("2d", { willReadFrequently: true })!;
  octx.drawImage(sheet, 0, 0);
  const data = octx.getImageData(0, 0, sheet.width, sheet.height).data;
  hitMask = new Uint8Array(sheet.width * sheet.height);
  for (let i = 0; i < hitMask.length; i++) hitMask[i] = data[i * 4 + 3];
  maskW = sheet.width;
}

/** Re-read window position and DPI. Called at boot and after any move. */
async function syncWindowGeometry() {
  const size = windowSize(viewport);
  await win.setSize(new LogicalSize(size.x, size.y));
  const sf = await win.scaleFactor();
  const p = await win.outerPosition();
  const logical = physicalToLogical({ x: p.x, y: p.y }, sf);
  viewport = { ...viewport, winX: logical.x, winY: logical.y, scaleFactor: sf };
  const monitor = await currentMonitor().catch(() => null);
  if (!monitor) return;
  const monitorScale = monitor.scaleFactor || sf || 1;
  const next = clampToMonitor(
    { x: viewport.winX, y: viewport.winY },
    viewport,
    {
      x: monitor.position.x / monitorScale,
      y: monitor.position.y / monitorScale,
      width: monitor.size.width / monitorScale,
      height: monitor.size.height / monitorScale,
    },
    { top: 12, right: 12, bottom: 12, left: 12 },
  );
  if (next.x !== viewport.winX || next.y !== viewport.winY) {
    viewport = { ...viewport, winX: next.x, winY: next.y };
    await win.setPosition(new LogicalPosition(Math.round(next.x), Math.round(next.y)));
  }
}

// ─── Signal derivation ────────────────────────────────────────────────────────

/**
 * Turn one Rust snapshot into engine Signals. This is where raw numbers become
 * intentions, and where every threshold conversion happens exactly once.
 */
function toSignals(a: Activity, now: number): Signals {
  // Velocity arrives in physical px/s; the plan's thresholds are logical.
  const velocity = normaliseVelocity(a.cursor_velocity, viewport.scaleFactor);
  const kps = keysPerSecond(a.keys_since_last, a.batch_ms || 66);

  const sprite = globalToSprite({ x: a.cursor_x, y: a.cursor_y }, viewport);
  const overHead = sprite !== null
    && sprite.y < viewport.cell * HEAD_FRACTION
    && isSolid(sprite.x, sprite.y);

  // Petting is stroking *over the head*; the detector only sees motion while
  // the cursor is actually on the dog, so wandering elsewhere can't trigger it.
  const petting = !dragging && overHead
    ? pettingDetector.update(now, a.cursor_x)
    : (pettingDetector.reset(), false);

  const shaking = dragging ? shakeDetector.update(now, a.cursor_x) : (shakeDetector.reset(), false);

  const chasing = chaseDetector.update(now, velocity > THRESHOLDS.chaseVelocity);
  const alert = velocity > THRESHOLDS.alertVelocity;

  const justWoke = wasAsleep && a.idle_ms < 1000;
  wasAsleep = a.idle_ms > THRESHOLDS.sleepMs;

  return {
    dragging, petting, shaking, chasing, alert,
    scrolling: a.scroll_delta > SCROLL_ACTIVE,
    clicking: a.clicks_since_last > 0,
    typingKps: kps,
    idleMs: a.idle_ms,
    reminder: pendingReminder,
    agentEvent: pendingAgentEvent,
    justWoke,
    availableFrames: available,
    reducedMotion,
  };
}

function isSolid(sx: number, sy: number): boolean {
  const f = atlas.frames[visibleFrame] ?? atlas.frames[currentFrame] ?? atlas.frames["idle"];
  if (!f) return false;
  const i = (f.y + sy) * maskW + (f.x + sx);
  return i >= 0 && i < hitMask.length && hitMask[i] > HIT_ALPHA;
}

function onActivity(a: Activity) {
  const now = performance.now();
  const out = engine.update(now, toSignals(a, now));

  currentFrame = out.frame;
  mode = out.mode;

  // One-shot signals are consumed once the engine has seen them.
  if (out.changed && out.state === "reminder") pendingReminder = null;
  if (out.changed && out.state === "agent" && pendingAgentEvent !== "thinking") pendingAgentEvent = null;

  if (out.changed && out.sound) playSound(out.sound);
  if (out.changed && out.state === "pet") handlePetTouch();

  if (!dragging) {
    facingLeft = a.cursor_x < windowCentre(viewport).x;
    void updateHitState(a.cursor_x, a.cursor_y);
    void followCursorAttention(a, now);
  }
}

let pendingSound: CompanionSoundName | null = null;
let lastSoundAt = 0;

function playSound(name: string) {
  if (!settings.soundEnabled || quietMode) return;
  const sound = name as CompanionSoundName;
  const now = performance.now();
  // A single click can be observed by both the local canvas and the privacy-
  // safe activity stream. Keep that from becoming two overlapping animal calls.
  if (now - lastSoundAt < 220) return;
  lastSoundAt = now;
  void playCompanionSound(sound, settings.soundVolume).then(played => {
    pendingSound = played ? null : sound;
  }).catch(() => { pendingSound = sound; });
}

async function unlockAndFlushAudio() {
  const audio = await unlockCompanionAudio().catch(() => null);
  if (!audio || !pendingSound || !settings.soundEnabled || quietMode) return;
  const sound = pendingSound;
  pendingSound = null;
  const played = await playCompanionSound(sound, settings.soundVolume).catch(() => false);
  if (!played) pendingSound = sound;
}

// ─── Reminders, Pomodoro, pinned note (Phase 4) ────────────────────────────────

function buildScheduler(s: Settings, now: number): SchedulerState {
  return {
    stretch: makeRepeating("stretch", s.stretchEveryMinutes, now, s.stretchEnabled),
    water: makeRepeating("water", s.waterEveryMinutes, now, s.waterEnabled),
    messages: scheduledMessagesFromSettings(s, now),
    pomodoro: stopPomodoro(startPomodoro(now, s.pomodoro)),
    quietFrom: s.quietFrom,
    quietTo: s.quietTo,
  };
}

function scheduledMessagesFromSettings(s: Settings, now: number) {
  const msg = s.scheduledMessage;
  if (!msg.enabled || msg.at === "" || msg.text.trim() === "") return [];
  const target = Date.parse(msg.at);
  if (Number.isNaN(target)) return [];
  const fireAt = now + (target - Date.now());
  return [{
    id: "settings-message",
    fireAt,
    text: personalise(msg.text, s.ownerName),
    fired: fireAt < now,
  }];
}

/** Runs once a second. Turns "a reminder is due" into something the dog does. */
function pollReminders() {
  if (!scheduler) return;
  const out = pollScheduler(scheduler, performance.now(), new Date().getHours(), quietMode);

  if (out.reminder) {
    pendingReminder = out.reminder;
    const text = out.message
      ?? personalise(out.reminder === "water" ? REMINDER_TEXT.water : REMINDER_TEXT.stretch, settings.ownerName);
    flashNote(text);
    showNativeReminder(text);
  }
  if (out.agentLikeCelebration) {
    pendingAgentEvent = "done";
    showNativeReminder(personalise(REMINDER_TEXT.focusDone, settings.ownerName));
  }

  // Pomodoro clock (empty string when not running).
  clockEl.textContent = out.clock ?? "";
  clockEl.classList.toggle("hidden", out.clock === null);
}

function showNativeReminder(body: string) {
  if (!settings.notificationsEnabled || !notificationsGranted) return;
  try {
    sendNotification({ title: `${settings.petName} · MyPerro`, body });
  } catch (error) {
    void logWarn(`Native reminder could not be delivered: ${String(error)}`).catch(() => {});
  }
}

function togglePomodoro() {
  if (!scheduler) return;
  scheduler.pomodoro = scheduler.pomodoro.phase === "off"
    ? startPomodoro(performance.now(), settings.pomodoro)
    : stopPomodoro(scheduler.pomodoro);
}

async function togglePeekMode() {
  await applyPeekMode(!peekMode);
}

function toggleQuietMode() {
  quietMode = !quietMode;
  if (quietMode) stopPlayRequest(false);
  document.body.classList.toggle("quiet", quietMode);
  flashNote(quietMode
    ? `${settings.petName} will stay quiet for now.`
    : `${settings.petName} is back on reminder duty.`);
}

function triggerPlay() {
  playUntil = performance.now() + 5000;
  wanderUntil = playUntil;
}

async function applyPeekMode(enabled: boolean) {
  if (peekTimer) {
    clearTimeout(peekTimer);
    peekTimer = null;
  }
  peekMode = enabled;
  document.body.classList.toggle("peek", enabled);
  if (!enabled) {
    if (beforePeekPosition) {
      viewport = { ...viewport, ...beforePeekPosition };
      await win.setPosition(new LogicalPosition(Math.round(viewport.winX), Math.round(viewport.winY)));
      beforePeekPosition = null;
    }
    return;
  }

  if (!beforePeekPosition) beforePeekPosition = { x: viewport.winX, y: viewport.winY };
  const monitor = await currentMonitor().catch(() => null);
  const size = windowSize(viewport);
  if (!monitor) return;

  const sf = monitor.scaleFactor || viewport.scaleFactor || 1;
  const left = monitor.position.x / sf;
  const top = monitor.position.y / sf;
  const width = monitor.size.width / sf;
  const height = monitor.size.height / sf;
  const visibleWidth = Math.max(56, Math.round(size.x * 0.34));

  viewport = {
    ...viewport,
    winX: left + width - visibleWidth,
    winY: top + Math.round(height * 0.58),
  };
  await win.setPosition(new LogicalPosition(Math.round(viewport.winX), Math.round(viewport.winY)));
  peekTimer = setTimeout(() => {
    void applyPeekMode(false);
  }, 20_000);
}

/** The always-on pinned note from settings. */
function applyPinnedNote() {
  const note = settings.pinnedNote.trim();
  noteEl.textContent = note;
  noteEl.classList.toggle("hidden", note === "");
}

/** A reminder note that shows for a few seconds, then falls back to the pinned one. */
let noteTimer: ReturnType<typeof setTimeout> | null = null;
function flashNote(text: string, durationMs = MESSAGE_DURATION_MS) {
  noteEl.textContent = text;
  noteEl.classList.remove("hidden");
  if (noteTimer) clearTimeout(noteTimer);
  noteTimer = setTimeout(applyPinnedNote, durationMs);
}

function dismissTransientNote() {
  if (noteTimer) clearTimeout(noteTimer);
  noteTimer = null;
  applyPinnedNote();
}

async function pollAgentStatus() {
  const raw = await invoke<AgentStatusFile | null>("load_agent_status").catch(() => null);
  if (!raw || raw.status === "idle") return;
  if (!["thinking", "done", "error"].includes(raw.status)) return;

  const signature = `${raw.status}:${raw.updatedAt ?? ""}:${raw.message ?? ""}`;
  if (signature === lastAgentStatusSignature) return;
  lastAgentStatusSignature = signature;

  pendingAgentEvent = raw.status;
  if (raw.message?.trim()) flashNote(personalise(raw.message, settings.ownerName));
  else if (raw.status === "thinking") flashNote(`${settings.petName} is watching your agent think...`);
  else if (raw.status === "done") flashNote(personalise(REMINDER_TEXT.focusDone, settings.ownerName));
  else flashNote(`${settings.petName} noticed the agent needs attention.`);

  if (raw.status !== "thinking") {
    await invoke("clear_agent_status").catch(() => {});
  }
}

async function autoWander() {
  const now = performance.now();
  const idleFor = lastActivityAt === 0 ? now : now - lastActivityAt;
  if (
    reducedMotion || dragging || peekMode || degraded || performance.now() < restUntil ||
    mode !== "idle" || idleFor < 28_000 || now - lastAutoWanderAt < 12_000
  ) return;

  const monitor = await currentMonitor().catch(() => null);
  if (!monitor) return;
  const sf = monitor.scaleFactor || viewport.scaleFactor || 1;
  const area = {
    x: monitor.position.x / sf,
    y: monitor.position.y / sf,
    width: monitor.size.width / sf,
    height: monitor.size.height / sf,
  };
  const step = 18 + Math.round((Math.sin(now / 3700) + 1) * 14);
  const direction = Math.sin(now / 5100) >= 0 ? 1 : -1;
  const vertical = Math.round(Math.sin(now / 2900) * 10);
  const next = clampToMonitor(
    { x: viewport.winX + step * direction, y: viewport.winY + vertical },
    viewport,
    area,
    { top: 18, right: 18, bottom: 18, left: 18 },
  );

  if (Math.abs(next.x - viewport.winX) < 1 && Math.abs(next.y - viewport.winY) < 1) return;
  facingLeft = next.x < viewport.winX;
  viewport = { ...viewport, winX: next.x, winY: next.y };
  lastAutoWanderAt = now;
  wanderUntil = now + 1400;
  await win.setPosition(new LogicalPosition(Math.round(next.x), Math.round(next.y)));
}

async function followCursorAttention(a: Activity, now: number) {
  const idleEnough = a.idle_ms < 3000 && a.keys_since_last === 0 && a.clicks_since_last === 0;
  if (!idleEnough || mode !== "idle") return;
  const monitor = await monitorFromPoint(a.cursor_x, a.cursor_y).catch(() => null);
  if (!monitor) return;
  const sf = monitor.scaleFactor || viewport.scaleFactor || 1;
  const move = attentionMove({
    cursor: { x: a.cursor_x / sf, y: a.cursor_y / sf },
    viewport,
    monitor: {
      x: monitor.position.x / sf,
      y: monitor.position.y / sf,
      width: monitor.size.width / sf,
      height: monitor.size.height / sf,
    },
    now,
    lastMovedAt: lastAttentionMoveAt,
    reducedMotion,
    disabled: dragging || peekMode || degraded || performance.now() < playUntil || performance.now() < restUntil,
  });
  if (!move) return;
  viewport = { ...viewport, winX: move.next.x, winY: move.next.y };
  facingLeft = move.facingLeft;
  lastAttentionMoveAt = now;
  wanderUntil = now + 1200;
  await win.setPosition(new LogicalPosition(Math.round(move.next.x), Math.round(move.next.y)));
}

// ─── Click-through ────────────────────────────────────────────────────────────

async function updateHitState(gx: number, gy: number) {
  if (dragging || degraded) return;
  const sprite = globalToSprite({ x: gx, y: gy }, viewport);
  const solid = sprite !== null && isSolid(sprite.x, sprite.y);
  const shouldIgnore = !solid;
  if (shouldIgnore !== ignoringCursor) {
    ignoringCursor = shouldIgnore;
    await win.setIgnoreCursorEvents(shouldIgnore);
  }
}

/**
 * Without input monitoring there is no cursor position, so per-pixel hit
 * testing is impossible. Trade it for a solid rectangular window the user can
 * still grab — degraded, but not bricked.
 */
function startDegradedWatchdog() {
  setInterval(async () => {
    const stale = isDegraded(performance.now(), lastActivityAt);
    if (stale === degraded) return;
    degraded = stale;
    if (degraded) {
      ignoringCursor = false;
      await win.setIgnoreCursorEvents(false);
    }
  }, 1000);
}

// ─── Dragging ─────────────────────────────────────────────────────────────────

function wireDrag() {
  let grab = { x: 0, y: 0 };

  // Screen coordinates, not client: the window moves with the cursor during a
  // drag, so clientX barely changes and the dog would stick in place.
  canvas.addEventListener("mousedown", e => {
    if (e.button !== 0) return;
    dragging = true;
    document.body.classList.add("dragging");
    grab = { x: e.screenX, y: e.screenY };
    shakeDetector.reset();
    e.preventDefault();
  });

  window.addEventListener("mousemove", e => {
    if (!dragging) return;
    viewport = {
      ...viewport,
      winX: viewport.winX + (e.screenX - grab.x),
      winY: viewport.winY + (e.screenY - grab.y),
    };
    grab = { x: e.screenX, y: e.screenY };
    win.setPosition(new LogicalPosition(Math.round(viewport.winX), Math.round(viewport.winY)));
  });

  window.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    document.body.classList.remove("dragging");
    shakeDetector.reset();
    void syncWindowGeometry();     // the drag may have crossed monitors
  });

  canvas.addEventListener("contextmenu", e => { e.preventDefault(); invoke("open_settings"); });
}

// ─── Render loop ──────────────────────────────────────────────────────────────

let lastDraw = 0;

function loop(now: number) {
  requestAnimationFrame(loop);
  if (!shouldDraw(now, lastDraw, mode)) return;
  lastDraw = now;

  draw();

  frames++;
  if (now - lastFpsAt >= 1000) {
    fps = frames; frames = 0;
    eventRate = eventCount; eventCount = 0;
    lastFpsAt = now;
    void renderHud();
  }
}

function draw() {
  const now = performance.now();
  visibleFrame = idleLifeFrame({
    frame: currentFrame,
    mode,
    now,
    lastActivityAt,
    availableFrames: available,
    reducedMotion,
  });
  if (now < wanderUntil) {
    visibleFrame = available.has("walk_a") ? "walk_a" : visibleFrame;
  }
  if (now < playUntil) {
    visibleFrame = available.has("zoomies") ? "zoomies" : visibleFrame;
  }
  const showingCare = now < careUntil;
  if (showingCare) {
    visibleFrame = available.has(careFrame) ? careFrame : visibleFrame;
  }
  visibleFrame = animatedCel(visibleFrame, showingCare ? now - careFrameStartedAt : now, available);
  const f = atlas.frames[visibleFrame] ?? atlas.frames[currentFrame] ?? atlas.frames["idle"];
  if (!f) return;
  const offset = motionOffset(now);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  if (facingLeft) { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
  drawSpriteCel(f, offset, now);
  drawMarkingStyle(offset);
  drawEyeFollow(offset);
  ctx.restore();
  drawStateEffects(now);
}

/** Apply pose-specific squash, stretch and anticipation around the sprite centre. */
function drawSpriteCel(f: Frame, offset: { x: number; y: number }, now: number) {
  if (reducedMotion) {
    ctx.drawImage(sheet, f.x, f.y, f.w, f.h, offset.x, offset.y, f.w, f.h);
    return;
  }
  const base = visibleFrame.replace(/_alt$/, "");
  const t = now / 1000;
  let sx = 1, sy = 1, rotate = 0;
  if (base === "drag") { sx = 0.94; sy = 1.1; rotate = Math.sin(t * 16) * 0.025; }
  else if (base === "shake") { sx = 1.04; sy = 0.97; rotate = Math.sin(t * 34) * 0.06; }
  else if (["happy_jump", "jump", "land"].includes(base)) { sx = 0.98; sy = 1.04; }
  else if (["run", "chase", "zoomies"].includes(base)) { sx = 1.05; sy = 0.96; }
  else if (["type_paw", "type_intense"].includes(base)) { sx = 1.01; sy = 0.99; }
  else if (base === "pet_happy") { const pulse = Math.sin(t * 9) * 0.015; sx += pulse; sy += pulse; }
  else if (base === "tail_wag") { rotate = Math.sin(t * 10) * 0.018; sx = 1.01; sy = 0.99; }
  else if (base === "head_tilt") { rotate = Math.sin(t * 2.4) * 0.055; }
  else if (base === "look_up") { sy = 1.025; sx = 0.985; }
  else if (base === "scratch") { rotate = Math.sin(t * 15) * 0.035; }
  else if (base === "yawn" || base === "stretch") { sx = 1.035; sy = 0.97; }
  else if (base === "drink" || base === "eat") { sy = 1 + Math.sin(t * 12) * 0.012; }
  else if (base === "sleep" || base === "lie_down") { const breath = Math.sin(t * 2.5) * 0.008; sx += breath; sy -= breath; }
  const cx = canvas.width / 2, cy = canvas.height * 0.68;
  ctx.translate(cx, cy);
  ctx.rotate(rotate);
  ctx.scale(sx, sy);
  ctx.translate(-cx, -cy);
  ctx.drawImage(sheet, f.x, f.y, f.w, f.h, offset.x, offset.y, f.w, f.h);
}

function drawStateEffects(now: number) {
  if (reducedMotion) return;
  const frame = visibleFrame.replace(/_alt$/, "");
  const t = now / 1000;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.scale(canvas.width / 96, canvas.height / 96);

  if (frame === "type_paw" || frame === "type_intense") {
    const rapid = frame === "type_intense";
    const key = Math.floor(t * (rapid ? 18 : 9)) % 5;
    ctx.fillStyle = rapid ? "#ffd45a" : "#83d9ff";
    ctx.fillRect(31 + key * 8, 78 + (key % 2), 4, 2);
    if (rapid) {
      ctx.fillStyle = `rgba(255,74,48,${0.12 + Math.abs(Math.sin(t * 8)) * 0.16})`;
      ctx.fillRect(45, 27, 40, 34);
      drawSteam(61, 19, t, 0); drawSteam(73, 13, t, 1); drawSteam(84, 21, t, 2);
    }
  } else if (frame === "pet_happy") {
    drawFloatingHeart(20, 39, t, 0); drawFloatingHeart(82, 31, t, 1);
  } else if (["run", "chase", "zoomies"].includes(frame)) {
    ctx.fillStyle = "rgba(255,255,255,.72)";
    for (let i = 0; i < 3; i++) {
      const x = 7 + ((t * 45 + i * 17) % 22);
      ctx.fillRect(Math.round(x), 46 + i * 10, 13 - i * 2, 2);
    }
    ctx.fillStyle = "rgba(190,161,126,.55)";
    ctx.fillRect(19, 81, 7, 3); ctx.fillRect(11, 76, 4, 3);
  } else if (frame === "paper_unroll") {
    ctx.strokeStyle = "rgba(117,83,54,.65)"; ctx.lineWidth = 1;
    const wave = Math.round(Math.sin(t * 12) * 2);
    ctx.beginPath(); ctx.moveTo(25, 82 + wave); ctx.lineTo(67, 82 - wave); ctx.stroke();
  } else if (frame === "drink") {
    ctx.fillStyle = "#8bd8ef";
    const splash = Math.floor(t * 8) % 3;
    ctx.fillRect(77 + splash * 3, 65 - splash * 3, 2, 3);
  } else if (frame === "eat") {
    ctx.fillStyle = "#f1b53b";
    const bite = Math.floor(t * 7) % 3;
    ctx.fillRect(39 + bite * 8, 70 - bite, 3, 3);
  } else if (frame === "beg") {
    drawFloatingHeart(82, 31, t, 0);
  } else if (frame === "focus_sit") {
    ctx.strokeStyle = "rgba(255,220,92,.85)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(84, 24, 7, -Math.PI / 2, -Math.PI / 2 + (t % 1) * Math.PI * 2); ctx.stroke();
  } else if (["sleep", "lie_down"].includes(frame)) {
    ctx.fillStyle = "#7cb9ee"; ctx.font = "bold 9px ui-monospace, monospace";
    ctx.fillText("z", 73, 27 - Math.round((t * 5) % 7));
    ctx.fillText("Z", 83, 18 - Math.round((t * 4) % 8));
  } else if (frame === "head_tilt" && engine?.state === "agent") {
    ctx.fillStyle = "#f3c957";
    for (let i = 0; i < 3; i++) ctx.fillRect(73 + i * 6, 20 + Math.round(Math.sin(t * 5 + i) * 2), 3, 3);
  } else if (["happy_jump", "tail_wag"].includes(frame)) {
    drawSparkle(20, 31, t, 0); drawSparkle(83, 22, t, 1);
  } else if (frame === "bark") {
    ctx.strokeStyle = "#f4c94f"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(83, 45, 7 + (t * 8) % 5, -0.7, 0.7); ctx.stroke();
  }
  ctx.restore();
}

function drawSteam(x: number, y: number, t: number, phase: number) {
  const rise = (t * 13 + phase * 5) % 10;
  ctx.fillStyle = `rgba(245,247,250,${0.9 - rise * 0.055})`;
  ctx.fillRect(x + Math.round(Math.sin(t * 6 + phase) * 2), y - Math.round(rise), 5, 4);
}

function drawFloatingHeart(x: number, y: number, t: number, phase: number) {
  const rise = (t * 8 + phase * 6) % 14;
  const px = x + Math.round(Math.sin(t * 4 + phase) * 2), py = y - Math.round(rise);
  ctx.fillStyle = `rgba(239,91,103,${1 - rise / 18})`;
  ctx.fillRect(px, py, 2, 2); ctx.fillRect(px + 3, py, 2, 2);
  ctx.fillRect(px - 1, py + 2, 7, 2); ctx.fillRect(px + 1, py + 4, 3, 2);
}

function drawSparkle(x: number, y: number, t: number, phase: number) {
  const on = Math.sin(t * 7 + phase * 2) > -0.15;
  if (!on) return;
  ctx.fillStyle = "#ffe37b";
  ctx.fillRect(x + 2, y, 2, 6); ctx.fillRect(x, y + 2, 6, 2);
}

function drawMarkingStyle(offset: { x: number; y: number }) {
  if (atlas.artStyle?.startsWith("premium-")) return;
  const style = settings.appearance.markingStyle;
  if (style === "classic" || EYELESS_FRAMES.has(visibleFrame)) return;
  const mark = settings.appearance.markingColor;
  ctx.fillStyle = mark;

  const ox = Math.round(offset.x);
  const oy = Math.round(offset.y);
  if (settings.appearance.breed.endsWith("-cat")) {
    if (style === "mask") {
      ctx.fillRect(ox + 55, oy + 35, 7, 5);
      ctx.fillRect(ox + 70, oy + 35, 7, 5);
      ctx.fillRect(ox + 62, oy + 38, 5, 2);
    } else if (style === "patch") {
      ctx.fillRect(ox + 72, oy + 32, 8, 10);
      ctx.fillRect(ox + 54, oy + 42, 7, 5);
      ctx.fillRect(ox + 42, oy + 57, 10, 6);
    } else if (style === "freckles") {
      for (const [x, y] of [[57, 48], [62, 50], [73, 48], [78, 51], [45, 59]]) {
        ctx.fillRect(ox + x, oy + y, 2, 2);
      }
    }
    return;
  }

  if (style === "mask") {
    ctx.fillRect(ox + 54, oy + 35, 8, 5);
    ctx.fillRect(ox + 70, oy + 35, 8, 5);
    ctx.fillRect(ox + 62, oy + 39, 4, 3);
  } else if (style === "patch") {
    ctx.fillRect(ox + 70, oy + 33, 8, 9);
    ctx.fillRect(ox + 72, oy + 42, 5, 3);
    ctx.fillRect(ox + 42, oy + 53, 10, 7);
  } else if (style === "freckles") {
    for (const [x, y] of [[57, 47], [62, 49], [74, 47], [78, 50], [46, 58]]) {
      ctx.fillRect(ox + x, oy + y, 2, 2);
    }
  }
}

function motionOffset(now: number): { x: number; y: number } {
  if (reducedMotion) return { x: 0, y: 0 };
  const t = now / 1000;

  const s = canvas.width / 96;
  if (dragging || visibleFrame === "shake") {
    return { x: Math.round(Math.sin(t * 38) * 2 * s), y: 0 };
  }
  if (visibleFrame === "happy_jump" || visibleFrame === "jump" || visibleFrame === "land") {
    return { x: 0, y: -Math.max(0, Math.round(Math.sin(t * 13) * 4 * s)) };
  }
  if (visibleFrame === "run" || visibleFrame === "chase" || visibleFrame === "zoomies") {
    return { x: 0, y: Math.round(Math.sin(t * 24) * 2 * s) };
  }
  if (visibleFrame === "type_paw" || visibleFrame === "type_intense") {
    return { x: 0, y: Math.round(Math.sin(t * 18) * s) };
  }
  if (visibleFrame === "idle" || visibleFrame === "focus_sit" || visibleFrame === "sit_side") {
    return { x: 0, y: Math.round(Math.sin(t * 3) * 0.7 * s) };
  }

  return { x: 0, y: 0 };
}

function drawEyeFollow(offset: { x: number; y: number }) {
  if (reducedMotion || EYELESS_FRAMES.has(visibleFrame)) return;
  const base = visibleFrame.replace(/_alt$/, "");
  if (!["idle", "sit", "stand", "sit_side", "head_tilt", "look_up", "side_eye", "alert"].includes(base)) return;
  const look = eyeOffset();
  const scale = canvas.width / 96;
  const defaultEyes = [{ x: 58 * scale, y: 39 * scale }, { x: 72 * scale, y: 39 * scale }];
  const eyes = atlas.landmarks?.eyes?.length ? atlas.landmarks.eyes : defaultEyes;

  for (const eye of eyes) {
    const x = Math.round(offset.x + eye.x + look.x * scale);
    const y = Math.round(offset.y + eye.y + look.y * scale);
    ctx.fillStyle = "#251912";
    const pupil = Math.max(2, Math.round(scale * 2));
    ctx.fillRect(x, y, pupil, pupil);
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fillRect(x, y, Math.max(1, Math.round(scale)), Math.max(1, Math.round(scale)));
  }
}

function eyeOffset(): { x: number; y: number } {
  if (!lastActivity) return { x: 0, y: 0 };
  const centre = windowCentre(viewport);
  const dx = Math.max(-1, Math.min(1, Math.round((lastActivity.cursor_x - centre.x) / 120)));
  const dy = Math.max(-1, Math.min(1, Math.round((lastActivity.cursor_y - centre.y) / 120)));
  if (visibleFrame === "look_up") return { x: dx, y: -1 };
  if (visibleFrame === "side_eye") return { x: facingLeft ? -2 : 2, y: 0 };
  return { x: dx, y: dy };
}

// ─── Diagnostics HUD ──────────────────────────────────────────────────────────

function wireHud() {
  window.addEventListener("keydown", e => {
    if (!e.ctrlKey || !e.shiftKey) return;
    if (e.key.toLowerCase() === "h") hudEl.classList.toggle("hidden");
    if (e.key.toLowerCase() === "m") reducedMotion = !reducedMotion;
  });
}

async function renderHud() {
  const perf = await invoke<{ cpu: number; mem_mb: number }>("perf_stats").catch(() => null);
  const a = lastActivity;
  const vel = a ? normaliseVelocity(a.cursor_velocity, viewport.scaleFactor) : 0;
  hudEl.textContent =
    `MyPerro · phase 2\n` +
    `state    ${engine?.state ?? "—"}  →  ${currentFrame}${facingLeft ? " ◀" : " ▶"}\n` +
    `fps      ${fps}  (mode ${mode}, cap ${FPS[mode]})\n` +
    `cpu      ${perf ? perf.cpu.toFixed(1) + "%" : "—"}\n` +
    `mem      ${perf ? perf.mem_mb.toFixed(0) + " MB" : "—"}\n` +
    `events   ${eventRate}/s  (batch ${a?.batch_ms ?? "—"}ms)\n` +
    `pass-thru ${ignoringCursor ? "on " : "OFF"}${degraded ? "  [DEGRADED: no input perm]" : ""}\n` +
    `cursor   ${a ? `${a.cursor_x | 0},${a.cursor_y | 0}` : "—"}  v=${vel | 0} logical px/s\n` +
    `keys/s   ${a ? keysPerSecond(a.keys_since_last, a.batch_ms || 66).toFixed(1) : "—"}` +
    `   idle ${a ? (a.idle_ms / 1000) | 0 : "—"}s\n` +
    `motion   ${reducedMotion ? "reduced" : "full"}\n` +
    `quiet    ${quietMode ? "on" : "off"}\n` +
    `[ctrl+shift+h] hide  [ctrl+shift+m] reduced motion`;
}

boot().catch(async err => {
  const message = err instanceof Error ? err.message : String(err);
  await logError(`Pet startup failed: ${message}`).catch(() => {});
  // Never expose an internal stack or URL on the desktop. Keep Settings
  // reachable so the user has a recovery path even if an art pack is damaged.
  hudEl.textContent = "MyPerro needs attention";
  hudEl.classList.remove("hidden");
  hudEl.classList.add("error");
  noteEl.textContent = "Press S or open Settings from the tray to repair this companion.";
  noteEl.classList.remove("hidden");
});
