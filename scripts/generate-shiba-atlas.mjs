#!/usr/bin/env node
/**
 * Generate Pawi's built-in Shiba placeholder atlas.
 *
 * This is intentionally original, simple pixel art drawn from primitives. It
 * is not final commissioned art, but it is much closer to the product's visual
 * language than the old blob placeholder and it gives every planned behaviour
 * a named frame to land on while the animation system matures.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const CELL = 96;
const COLS = 6;

const FRAMES = [
  "idle", "blink", "sit", "sit_side", "stand", "sleep",
  "lie_down", "wake", "yawn", "walk", "walk_a", "walk_b",
  "run", "chase", "turn", "jump", "happy_jump", "alert",
  "head_tilt", "look_up", "type_paw", "type_intense", "pant", "pet_happy",
  "tail_wag", "drag", "shake", "land", "stretch", "drink",
  "focus_sit", "deliver_note", "bark", "side_eye", "scratch", "zoomies",
];

const ROWS = Math.ceil(FRAMES.length / COLS);
const W = COLS * CELL;
const H = ROWS * CELL;
const rgba = Buffer.alloc(W * H * 4, 0);

const C = {
  outline: [78, 52, 38, 255],
  dark: [138, 78, 42, 255],
  mid: [201, 116, 52, 255],
  light: [230, 151, 75, 255],
  cream: [248, 219, 166, 255],
  cream2: [233, 190, 133, 255],
  eye: [34, 28, 24, 255],
  red: [198, 49, 48, 255],
  gold: [237, 184, 62, 255],
  blue: [80, 113, 160, 255],
  steam: [205, 211, 219, 220],
  shadow: [48, 36, 30, 80],
  note: [255, 244, 197, 255],
  paper: [244, 235, 206, 255],
};

function put(x, y, color) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  rgba[i] = color[0]; rgba[i + 1] = color[1]; rgba[i + 2] = color[2]; rgba[i + 3] = color[3];
}

function rect(x, y, w, h, color) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) put(xx, yy, color);
}

function ellipse(cx, cy, rx, ry, color) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) put(x, y, color);
    }
  }
}

function line(x0, y0, x1, y1, color, size = 2) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    const x = Math.round(x0 + (x1 - x0) * t);
    const y = Math.round(y0 + (y1 - y0) * t);
    rect(x, y, size, size, color);
  }
}

function tri(a, b, c, color) {
  const minX = Math.floor(Math.min(a[0], b[0], c[0]));
  const maxX = Math.ceil(Math.max(a[0], b[0], c[0]));
  const minY = Math.floor(Math.min(a[1], b[1], c[1]));
  const maxY = Math.ceil(Math.max(a[1], b[1], c[1]));
  const area = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / area;
    const v = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / area;
    const w = 1 - u - v;
    if (u >= 0 && v >= 0 && w >= 0) put(x, y, color);
  }
}

function drawTail(ox, oy, pose) {
  const curl = pose === "tail_wag" ? 6 : pose === "drag" ? -2 : 0;
  ellipse(ox + 34, oy + 45 + curl, 13, 14, C.outline);
  ellipse(ox + 35, oy + 45 + curl, 9, 10, C.light);
  ellipse(ox + 39, oy + 48 + curl, 6, 6, [0, 0, 0, 0]);
  ellipse(ox + 39, oy + 48 + curl, 4, 4, C.mid);
}

function drawDog(ox, oy, name) {
  const low = ["sleep", "lie_down", "stretch"].includes(name);
  const jump = ["jump", "happy_jump"].includes(name);
  const drag = name === "drag";
  const fast = ["run", "chase", "zoomies"].includes(name);
  const headTilt = name === "head_tilt" ? -5 : name === "side_eye" ? 3 : 0;
  const y = oy + (jump ? -10 : drag ? -7 : low ? 10 : 0);
  const stretch = fast ? 7 : name === "walk_b" ? -3 : 0;

  ellipse(ox + 48, oy + 79, 28, 5, C.shadow);

  if (name === "deliver_note") {
    rect(ox + 60, oy + 66, 20, 13, C.paper);
    rect(ox + 60, oy + 66, 20, 2, C.outline);
    line(ox + 61, oy + 67, ox + 70, oy + 75, C.cream2, 1);
    line(ox + 79, oy + 67, ox + 70, oy + 75, C.cream2, 1);
  }
  if (name === "drink") {
    rect(ox + 58, oy + 75, 23, 5, C.blue);
    rect(ox + 61, oy + 70, 17, 7, C.blue);
    rect(ox + 63, oy + 72, 13, 2, [153, 206, 224, 255]);
  }

  if (low) {
    ellipse(ox + 45, y + 55, 28 + stretch, 13, C.outline);
    ellipse(ox + 45, y + 54, 24 + stretch, 10, C.mid);
    ellipse(ox + 64, y + 47, 15, 13, C.outline);
    ellipse(ox + 64, y + 46, 12, 10, C.light);
  } else {
    drawTail(ox, y, name);
    ellipse(ox + 45, y + 57, 25 + stretch, 17, C.outline);
    ellipse(ox + 45, y + 56, 21 + stretch, 13, C.mid);
    ellipse(ox + 49, y + 61, 13, 8, C.light);
    ellipse(ox + 63 + headTilt, y + 38, 18, 17, C.outline);
    ellipse(ox + 63 + headTilt, y + 38, 15, 14, C.light);
  }

  // ears
  tri([ox + 50 + headTilt, y + 29], [ox + 55 + headTilt, y + 8], [ox + 63 + headTilt, y + 31], C.outline);
  tri([ox + 53 + headTilt, y + 28], [ox + 57 + headTilt, y + 14], [ox + 61 + headTilt, y + 30], C.mid);
  tri([ox + 68 + headTilt, y + 29], [ox + 78 + headTilt, y + 11], [ox + 80 + headTilt, y + 33], C.outline);
  tri([ox + 70 + headTilt, y + 29], [ox + 77 + headTilt, y + 17], [ox + 78 + headTilt, y + 32], C.mid);

  // muzzle and markings
  ellipse(ox + 66 + headTilt, y + 45, 10, 7, C.cream);
  ellipse(ox + 58 + headTilt, y + 40, 6, 7, C.cream);

  const eyeY = name === "look_up" ? y + 35 : y + 39;
  const leftEyeX = ox + 58 + headTilt;
  const rightEyeX = ox + 72 + headTilt;
  if (["blink", "pet_happy", "sleep"].includes(name)) {
    line(leftEyeX - 2, eyeY, leftEyeX + 2, eyeY, C.eye, 2);
    line(rightEyeX - 2, eyeY, rightEyeX + 2, eyeY, C.eye, 2);
  } else if (name === "side_eye") {
    rect(leftEyeX - 2, eyeY, 5, 2, C.eye);
    rect(rightEyeX - 2, eyeY, 5, 2, C.eye);
  } else {
    rect(leftEyeX, eyeY, 3, 3, C.eye);
    rect(rightEyeX, eyeY, 3, 3, C.eye);
    put(leftEyeX + 1, eyeY, [255, 255, 255, 255]);
    put(rightEyeX + 1, eyeY, [255, 255, 255, 255]);
  }
  rect(ox + 66 + headTilt, y + 47, 4, 3, C.eye);
  if (name === "bark" || name === "yawn") rect(ox + 68 + headTilt, y + 51, name === "yawn" ? 7 : 5, 5, C.eye);
  else rect(ox + 68 + headTilt, y + 52, 4, 1, C.eye);

  // collar and tag
  rect(ox + 53, y + 51, 20, 4, C.red);
  rect(ox + 63, y + 54, 5, 5, C.gold);

  // legs/paws
  const legY = y + (low ? 63 : 68);
  const dangle = drag ? 8 : 0;
  const stride = fast ? 8 : name === "walk_a" ? 4 : name === "walk_b" ? -4 : 0;
  rect(ox + 31 - stride, legY, 7, 13 + dangle, C.outline);
  rect(ox + 32 - stride, legY, 5, 11 + dangle, C.dark);
  rect(ox + 55 + stride, legY, 7, 13 + dangle, C.outline);
  rect(ox + 56 + stride, legY, 5, 11 + dangle, C.dark);
  rect(ox + 29 - stride, legY + 11 + dangle, 12, 4, C.outline);
  rect(ox + 53 + stride, legY + 11 + dangle, 12, 4, C.outline);

  if (name === "type_paw" || name === "type_intense") {
    rect(ox + 27, oy + 78, 43, 6, C.outline);
    rect(ox + 29, oy + 77, 39, 5, [72, 83, 101, 255]);
    if (name === "type_intense") {
      ellipse(ox + 75, oy + 24, 4, 6, C.steam);
      ellipse(ox + 82, oy + 18, 3, 4, C.steam);
      rect(ox + 56, y + 39, 3, 3, [170, 54, 48, 255]);
      rect(ox + 70, y + 39, 3, 3, [170, 54, 48, 255]);
    }
  }

  if (name === "pant") {
    rect(ox + 70 + headTilt, y + 52, 4, 8, [225, 94, 98, 255]);
    ellipse(ox + 77, oy + 28, 3, 4, [110, 181, 230, 255]);
  }
  if (name === "bark") {
    line(ox + 79, y + 45, ox + 88, y + 41, C.gold, 2);
    line(ox + 80, y + 51, ox + 89, y + 55, C.gold, 2);
  }
  if (name === "sleep") {
    rect(ox + 72, oy + 26, 8, 2, C.blue);
    rect(ox + 80, oy + 20, 7, 2, C.blue);
    rect(ox + 86, oy + 14, 6, 2, C.blue);
  }
  if (name === "land") {
    ellipse(ox + 31, oy + 81, 9, 3, C.steam);
    ellipse(ox + 63, oy + 82, 10, 3, C.steam);
  }
  if (name === "scratch") {
    line(ox + 39, oy + 67, ox + 27, oy + 50, C.dark, 4);
  }
  if (name === "zoomies") {
    line(ox + 8, oy + 43, ox + 24, oy + 43, C.steam, 2);
    line(ox + 5, oy + 54, ox + 22, oy + 54, C.steam, 2);
    line(ox + 12, oy + 65, ox + 27, oy + 65, C.steam, 2);
  }
}

function writePng(path, width, height, data) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const chunks = [];
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, payload) => {
    const name = Buffer.from(type);
    const len = Buffer.alloc(4); len.writeUInt32BE(payload.length);
    const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(Buffer.concat([name, payload])));
    chunks.push(Buffer.concat([len, name, payload, sum]));
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  chunk("IHDR", ihdr);
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    data.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  chunk("IDAT", deflateSync(raw, { level: 9 }));
  chunk("IEND", Buffer.alloc(0));
  writeFileSync(path, Buffer.concat([signature, ...chunks]));
}

const meta = { canvas: { width: CELL, height: CELL }, grid: { cols: COLS, rows: ROWS }, frames: {} };
FRAMES.forEach((name, index) => {
  const x = (index % COLS) * CELL;
  const y = Math.floor(index / COLS) * CELL;
  meta.frames[name] = { x, y, w: CELL, h: CELL, index };
  drawDog(x, y, name);
});

mkdirSync("art/placeholder", { recursive: true });
writePng("art/placeholder/shiba_placeholder.png", W, H, rgba);
writeFileSync("art/placeholder/shiba_placeholder.json", JSON.stringify(meta, null, 2) + "\n");
console.log(`wrote ${FRAMES.length} frames to art/placeholder/shiba_placeholder.*`);
