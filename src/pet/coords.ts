/**
 * The one place DPI and coordinate-space conversion is allowed to happen.
 *
 * Master plan §9.4. Scattering `/ scaleFactor` through the codebase is how
 * multi-monitor bugs get born: they only appear on someone else's machine,
 * with a second display at a different scale, and they're miserable to chase.
 * Everything funnels through here so there is exactly one thing to test.
 *
 * Spaces:
 *   physical  — raw OS pixels. What outerPosition() returns.
 *   logical   — physical / scaleFactor. What we position windows in.
 *   local     — logical, relative to the pet window's top-left.
 *   sprite    — local / displayScale. Indexes into the atlas.
 */

export interface Vec2 { x: number; y: number }

export interface Viewport {
  /** Pet window top-left, logical coordinates. */
  winX: number;
  winY: number;
  /** OS device-pixel ratio for the monitor the pet is currently on. */
  scaleFactor: number;
  /** Integer sprite magnification, e.g. 2. */
  displayScale: number;
  /** Sprite cell size in sprite pixels, e.g. 96. */
  cell: number;
}

export function physicalToLogical(p: Vec2, scaleFactor: number): Vec2 {
  const sf = safeScale(scaleFactor);
  return { x: p.x / sf, y: p.y / sf };
}

export function logicalToPhysical(p: Vec2, scaleFactor: number): Vec2 {
  const sf = safeScale(scaleFactor);
  return { x: p.x * sf, y: p.y * sf };
}

/** Global logical point → pet-window-local logical point. */
export function globalToLocal(p: Vec2, v: Viewport): Vec2 {
  return { x: p.x - v.winX, y: p.y - v.winY };
}

/**
 * Global logical point → sprite pixel. Floored, so it indexes a pixel rather
 * than sitting between two. Returns null when outside the sprite cell, which
 * is what stops a negative coordinate wrapping onto a neighbouring frame.
 */
export function globalToSprite(p: Vec2, v: Viewport): Vec2 | null {
  const scale = safeScale(v.displayScale);
  const l = globalToLocal(p, v);
  const x = Math.floor(l.x / scale);
  const y = Math.floor(l.y / scale);
  if (x < 0 || y < 0 || x >= v.cell || y >= v.cell) return null;
  return { x, y };
}

/** Logical size of the pet window. */
export function windowSize(v: Viewport): Vec2 {
  const s = v.cell * safeScale(v.displayScale);
  return { x: s, y: s };
}

/** Logical centre of the pet window, for "which way is the cursor" tests. */
export function windowCentre(v: Viewport): Vec2 {
  const s = windowSize(v);
  return { x: v.winX + s.x / 2, y: v.winY + s.y / 2 };
}

/**
 * Velocity thresholds in the plan are logical pixels per second, but raw
 * events arrive in physical pixels. On a 2× display an unconverted threshold
 * fires at half the intended speed, so the dog feels twitchy on Retina and
 * sluggish on a 1× external monitor — a bug that only shows up when someone
 * plugs in a second screen.
 */
export function normaliseVelocity(physicalPerSec: number, scaleFactor: number): number {
  return physicalPerSec / safeScale(scaleFactor);
}

/**
 * Clamp the window so the dog can't be dragged off-screen or stranded when a
 * monitor is unplugged. Insets keep it clear of menu bars and taskbars.
 */
export function clampToMonitor(
  pos: Vec2,
  v: Viewport,
  monitor: { x: number; y: number; width: number; height: number },
  insets: { top: number; bottom: number; left: number; right: number } = { top: 0, bottom: 0, left: 0, right: 0 },
): Vec2 {
  const size = windowSize(v);
  const minX = monitor.x + insets.left;
  const minY = monitor.y + insets.top;
  const maxX = monitor.x + monitor.width - insets.right - size.x;
  const maxY = monitor.y + monitor.height - insets.bottom - size.y;
  return {
    x: clamp(pos.x, minX, Math.max(minX, maxX)),
    y: clamp(pos.y, minY, Math.max(minY, maxY)),
  };
}

/** True when the window is fully outside every known monitor — e.g. a display was unplugged. */
export function isStranded(
  v: Viewport,
  monitors: Array<{ x: number; y: number; width: number; height: number }>,
): boolean {
  const size = windowSize(v);
  return !monitors.some(m =>
    v.winX < m.x + m.width && v.winX + size.x > m.x &&
    v.winY < m.y + m.height && v.winY + size.y > m.y);
}

function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}

/** A zero or negative scale would produce Infinity or NaN and silently poison every downstream calculation. */
function safeScale(s: number): number {
  return Number.isFinite(s) && s > 0 ? s : 1;
}
