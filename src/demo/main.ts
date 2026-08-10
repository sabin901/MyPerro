/**
 * Browser demo of the real behaviour engine.
 *
 * Why this exists: the Tauri app needs a Rust toolchain, code signing and an
 * OS accessibility permission before anyone can see the dog move. That's a
 * long gap between writing behaviour and knowing whether it feels right.
 *
 * This page imports the *same* engine.ts and coords.ts the app uses, feeds it
 * synthetic Activity snapshots built from in-page mouse and keyboard events,
 * and renders with the same atlas. If the dog feels wrong here, it will feel
 * wrong in the app — and finding that out costs one `npm install` instead of
 * a full native build.
 *
 * What it can't tell you: anything about transparent windows, click-through,
 * always-on-top, or real CPU. Those are native, and still need the app.
 */

import { BehaviourEngine, SustainedDetector, ReversalDetector, STATES, type Signals, type ReminderKind, type AgentEvent } from "../pet/engine";
import { keysPerSecond, THRESHOLDS, FPS, shouldDraw, type Mode } from "../pet/behaviour";
import { globalToSprite, windowSize, normaliseVelocity, type Viewport } from "../pet/coords";

interface Frame { x: number; y: number; w: number; h: number }
interface Atlas { canvas: { width: number; height: number }; frames: Record<string, Frame> }

const DISPLAY_SCALE = 3;
const HEAD_FRACTION = 0.45;

const stage = document.getElementById("stage") as HTMLDivElement;
const canvas = document.getElementById("pet") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const readout = document.getElementById("readout")!;
const chips = document.getElementById("chips")!;
const typebox = document.getElementById("typebox") as HTMLTextAreaElement;

let atlas: Atlas;
let sheet: HTMLImageElement;
let mask: Uint8Array;
let maskW = 0;
let available = new Set<string>();

let engine: BehaviourEngine;
const chaseDetector = new SustainedDetector(200);
const pettingDetector = new ReversalDetector(1500, 3, 3);
const shakeDetector = new ReversalDetector(800, 3, 6);

let viewport: Viewport = { winX: 260, winY: 240, scaleFactor: 1, displayScale: DISPLAY_SCALE, cell: 96 };
let frame = "idle";
let mode: Mode = "idle";
let facingLeft = false;
let dragging = false;
let reducedMotion = false;

// synthetic activity accumulators
let cursor = { x: 0, y: 0 };
let lastCursor = { x: 0, y: 0 };
let distance = 0;
let keys = 0;
let clicks = 0;
let scroll = 0;
let lastInputAt = performance.now();
let idleOffset = 0;              // lets the buttons fake long idle periods
let pendingReminder: ReminderKind | null = null;
let pendingAgent: AgentEvent | null = null;
let justWokeFlag = false;

const BATCH_MS = 66;

async function boot() {
  const [meta, img] = await Promise.all([
    fetch("/placeholder/shiba_placeholder.json").then(r => r.json() as Promise<Atlas>),
    load("/placeholder/shiba_placeholder.png"),
  ]);
  atlas = meta; sheet = img;
  available = new Set(Object.keys(atlas.frames));

  canvas.width = atlas.canvas.width;
  canvas.height = atlas.canvas.height;
  ctx.imageSmoothingEnabled = false;
  viewport = { ...viewport, cell: atlas.canvas.width };
  const size = windowSize(viewport);
  canvas.style.width = `${size.x}px`;
  canvas.style.height = `${size.y}px`;

  buildMask();
  engine = new BehaviourEngine(performance.now());

  buildChips();
  wireInput();
  setInterval(tick, BATCH_MS);
  requestAnimationFrame(loop);
}

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i); i.onerror = () => rej(new Error(src)); i.src = src;
  });
}

function buildMask() {
  const off = document.createElement("canvas");
  off.width = sheet.width; off.height = sheet.height;
  const o = off.getContext("2d", { willReadFrequently: true })!;
  o.drawImage(sheet, 0, 0);
  const d = o.getImageData(0, 0, sheet.width, sheet.height).data;
  mask = new Uint8Array(sheet.width * sheet.height);
  for (let i = 0; i < mask.length; i++) mask[i] = d[i * 4 + 3];
  maskW = sheet.width;
}

function solidAt(sx: number, sy: number): boolean {
  const f = atlas.frames[frame] ?? atlas.frames["idle"];
  if (!f) return false;
  const i = (f.y + sy) * maskW + (f.x + sx);
  return i >= 0 && i < mask.length && mask[i] > 8;
}

/** One synthetic Activity snapshot — the same shape Rust emits. */
function tick() {
  const now = performance.now();
  const velocity = (distance * 1000) / BATCH_MS;
  const idleMs = (now - lastInputAt) + idleOffset;

  const sprite = globalToSprite(cursor, viewport);
  const overHead = sprite !== null && sprite.y < viewport.cell * HEAD_FRACTION && solidAt(sprite.x, sprite.y);

  const petting = !dragging && overHead ? pettingDetector.update(now, cursor.x) : (pettingDetector.reset(), false);
  const shaking = dragging ? shakeDetector.update(now, cursor.x) : (shakeDetector.reset(), false);
  const chasing = chaseDetector.update(now, normaliseVelocity(velocity, 1) > THRESHOLDS.chaseVelocity);

  const signals: Signals = {
    dragging, petting, shaking, chasing,
    alert: normaliseVelocity(velocity, 1) > THRESHOLDS.alertVelocity,
    scrolling: scroll > 40,
    clicking: clicks > 0,
    typingKps: keysPerSecond(keys, BATCH_MS),
    idleMs,
    reminder: pendingReminder,
    agentEvent: pendingAgent,
    justWoke: justWokeFlag,
    availableFrames: available,
    reducedMotion,
  };

  const out = engine.update(now, signals);
  frame = out.frame; mode = out.mode;
  if (out.changed && out.state === "reminder") pendingReminder = null;
  if (out.changed && out.state === "agent") pendingAgent = null;
  justWokeFlag = false;

  if (!dragging) {
    const centre = viewport.winX + windowSize(viewport).x / 2;
    facingLeft = cursor.x < centre;
  }

  render(signals, velocity, idleMs, out.state);

  distance = 0; keys = 0; clicks = 0; scroll = 0;
}

function wireInput() {
  stage.addEventListener("mousemove", e => {
    const r = stage.getBoundingClientRect();
    cursor = { x: e.clientX - r.left, y: e.clientY - r.top };
    distance += Math.hypot(cursor.x - lastCursor.x, cursor.y - lastCursor.y);
    lastCursor = { ...cursor };
    lastInputAt = performance.now(); idleOffset = 0;
    if (dragging) {
      viewport = { ...viewport, winX: viewport.winX + e.movementX, winY: viewport.winY + e.movementY };
      place();
    }
  });

  stage.addEventListener("wheel", e => { scroll += Math.abs(e.deltaY); lastInputAt = performance.now(); idleOffset = 0; });

  canvas.addEventListener("mousedown", e => {
    clicks++;
    dragging = true; canvas.classList.add("grabbing"); shakeDetector.reset(); e.preventDefault();
  });
  window.addEventListener("mouseup", () => { dragging = false; canvas.classList.remove("grabbing"); });

  typebox.addEventListener("keydown", () => { keys++; lastInputAt = performance.now(); idleOffset = 0; });

  document.querySelectorAll<HTMLButtonElement>("button[data-act]").forEach(b => {
    b.addEventListener("click", () => {
      switch (b.dataset.act) {
        case "water":   pendingReminder = "water"; break;
        case "stretch": pendingReminder = "stretch"; break;
        case "agent":   pendingAgent = "done"; break;
        case "idle60":  idleOffset = 61_000; break;
        case "idle5m":  idleOffset = 310_000; break;
        case "idle10m": idleOffset = 610_000; break;
        case "wake":    idleOffset = 0; lastInputAt = performance.now(); justWokeFlag = true; break;
        case "motion":  reducedMotion = !reducedMotion; break;
        case "reset":   engine.forceIdle(performance.now()); idleOffset = 0; lastInputAt = performance.now(); break;
      }
      typebox.blur();
    });
  });

  place();
}

function place() {
  canvas.style.left = `${viewport.winX}px`;
  canvas.style.top = `${viewport.winY}px`;
}

function buildChips() {
  chips.innerHTML = STATES.map(s => `<span class="chip" data-id="${s.id}">${s.id}</span>`).join("");
}

let lastDraw = 0;
function loop(now: number) {
  requestAnimationFrame(loop);
  if (!shouldDraw(now, lastDraw, mode)) return;
  lastDraw = now;
  const f = atlas.frames[frame] ?? atlas.frames["idle"];
  if (!f) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  if (facingLeft) { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
  ctx.drawImage(sheet, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
  ctx.restore();
}

function render(s: Signals, velocity: number, idleMs: number, state: string) {
  readout.textContent =
    `state    ${state}\n` +
    `frame    ${frame}${available.has(frame) ? "" : "  (missing → fallback)"}\n` +
    `mode     ${mode}  (cap ${FPS[mode]} fps)\n` +
    `velocity ${velocity | 0} px/s\n` +
    `keys/s   ${s.typingKps.toFixed(1)}\n` +
    `idle     ${(idleMs / 1000) | 0}s\n` +
    `petting  ${s.petting}   dragging ${s.dragging}\n` +
    `chasing  ${s.chasing}   shaking  ${s.shaking}\n` +
    `motion   ${reducedMotion ? "reduced" : "full"}`;

  chips.querySelectorAll<HTMLElement>(".chip").forEach(c => {
    c.classList.toggle("on", c.dataset.id === state);
  });
}

boot().catch(e => { readout.textContent = `boot failed: ${e}`; });
