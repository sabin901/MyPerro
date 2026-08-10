#!/usr/bin/env node
/**
 * Generate built-in prototype companion atlases.
 *
 * These are original programmer-art packs. They are intentionally not copied
 * from ComNyang or any other pet app. The goal is to give each companion a
 * clear chibi/anime pixel silhouette and enough expressive poses for product
 * work while the final animation pipeline grows up.
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
  "paper_unroll",
  // Alternate cels turn the most visible reactions into real animations rather
  // than a static drawing translated by the renderer.
  "type_paw_alt", "type_intense_alt", "pet_happy_alt", "tail_wag_alt",
  "run_alt", "paper_unroll_alt", "drink_alt", "sleep_alt",
  "beg", "eat", "eat_alt",
];

const BREEDS = [
  {
    id: "shiba-inu", name: "Shiba Inu", author: "MyPerro",
    body: [201, 116, 52], light: [230, 151, 75], mark: [248, 219, 166],
    outline: [78, 52, 38], species: "dog", tail: "curl", ears: "point", spots: "none", fluff: 0, bodyScale: 1,
  },
  {
    id: "pomeranian", name: "Pomeranian", author: "MyPerro",
    body: [221, 145, 82], light: [245, 182, 105], mark: [255, 225, 172],
    outline: [91, 59, 43], species: "dog", tail: "plume", ears: "small", spots: "mane", fluff: 8, bodyScale: 0.9,
  },
  {
    id: "husky", name: "Husky", author: "MyPerro",
    body: [96, 111, 128], light: [132, 151, 168], mark: [239, 244, 240],
    outline: [43, 55, 69], species: "dog", tail: "sickle", ears: "point", spots: "mask", fluff: 3, bodyScale: 1.08,
  },
  {
    id: "german-shepherd", name: "German Shepherd", author: "MyPerro",
    body: [183, 119, 55], light: [218, 156, 79], mark: [61, 52, 43],
    outline: [50, 39, 32], species: "dog", tail: "long", ears: "tall", spots: "saddle", fluff: 0, bodyScale: 1.14,
  },
  {
    id: "dalmatian", name: "Dalmatian", author: "MyPerro",
    body: [234, 233, 220], light: [255, 251, 232], mark: [54, 52, 49],
    outline: [58, 55, 49], species: "dog", tail: "long", ears: "floppy", spots: "spots", fluff: 0, bodyScale: 1,
  },
  {
    id: "lhasa-apso", name: "Lhasa Apso", author: "MyPerro",
    body: [190, 154, 105], light: [226, 196, 143], mark: [245, 226, 184],
    outline: [80, 63, 47], species: "dog", tail: "plume", ears: "floppy", spots: "shag", fluff: 10, bodyScale: 0.95,
  },
  {
    id: "calico-cat", name: "Calico Cat", author: "MyPerro",
    body: [247, 229, 197], light: [255, 241, 212], mark: [200, 117, 67],
    outline: [91, 61, 48], species: "cat", tail: "cat-curl", ears: "cat", spots: "calico", fluff: 1, bodyScale: 0.94,
  },
  {
    id: "midnight-cat", name: "Midnight Cat", author: "MyPerro",
    body: [52, 48, 68], light: [78, 72, 98], mark: [232, 214, 245],
    outline: [26, 24, 36], species: "cat", tail: "cat-long", ears: "cat", spots: "moon", fluff: 0, bodyScale: 0.9,
  },
  {
    id: "cream-tabby", name: "Cream Tabby", author: "MyPerro",
    body: [221, 170, 103], light: [245, 199, 128], mark: [142, 104, 70],
    outline: [82, 58, 42], species: "cat", tail: "cat-long", ears: "cat", spots: "tabby", fluff: 1, bodyScale: 0.92,
  },
];

const A = 255;
const common = {
  eye: [34, 28, 24, A],
  shine: [255, 255, 255, A],
  red: [198, 49, 48, A],
  gold: [237, 184, 62, A],
  blue: [80, 113, 160, A],
  steam: [205, 211, 219, 220],
  paper: [244, 235, 206, A],
  water: [153, 206, 224, A],
  tongue: [225, 94, 98, A],
  blush: [230, 126, 118, A],
  pad: [92, 56, 48, A],
  shadow: [55, 40, 32, 70],
};

function color(rgb, alpha = A) {
  return [rgb[0], rgb[1], rgb[2], alpha];
}

function shade(rgb, amount, alpha = A) {
  return [
    Math.max(0, Math.min(255, Math.round(rgb[0] * amount))),
    Math.max(0, Math.min(255, Math.round(rgb[1] * amount))),
    Math.max(0, Math.min(255, Math.round(rgb[2] * amount))),
    alpha,
  ];
}

function createCanvas(width, height) {
  const data = Buffer.alloc(width * height * 4, 0);
  const api = {
    width, height, data,
    put(x, y, c) {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      const i = (y * width + x) * 4;
      data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = c[3];
    },
    rect(x, y, w, h, c) {
      for (let yy = Math.round(y); yy < Math.round(y + h); yy++) {
        for (let xx = Math.round(x); xx < Math.round(x + w); xx++) api.put(xx, yy, c);
      }
    },
    ellipse(cx, cy, rx, ry, c) {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x - cx) / rx, dy = (y - cy) / ry;
          if (dx * dx + dy * dy <= 1) api.put(x, y, c);
        }
      }
    },
    line(x0, y0, x1, y1, c, size = 2) {
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let i = 0; i <= steps; i++) {
        const t = steps === 0 ? 0 : i / steps;
        api.rect(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), size, size, c);
      }
    },
    tri(a, b, c, fill) {
      const minX = Math.floor(Math.min(a[0], b[0], c[0]));
      const maxX = Math.ceil(Math.max(a[0], b[0], c[0]));
      const minY = Math.floor(Math.min(a[1], b[1], c[1]));
      const maxY = Math.ceil(Math.max(a[1], b[1], c[1]));
      const area = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
      for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
        const u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / area;
        const v = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / area;
        const w = 1 - u - v;
        if (u >= 0 && v >= 0 && w >= 0) api.put(x, y, fill);
      }
    },
  };
  return api;
}

function drawContactShadow(g, ox, oy, wide = 24) {
  g.ellipse(ox + 49, oy + 82, wide, 4, common.shadow);
}

function drawHeart(g, x, y, c) {
  g.rect(x + 1, y, 2, 2, c);
  g.rect(x + 4, y, 2, 2, c);
  g.rect(x, y + 2, 7, 2, c);
  g.rect(x + 1, y + 4, 5, 2, c);
  g.rect(x + 2, y + 6, 3, 2, c);
  g.rect(x + 3, y + 8, 1, 1, c);
}

function drawStar(g, x, y, c) {
  g.rect(x + 3, y, 2, 2, c);
  g.rect(x + 3, y + 6, 2, 2, c);
  g.rect(x, y + 3, 2, 2, c);
  g.rect(x + 6, y + 3, 2, 2, c);
  g.rect(x + 2, y + 2, 4, 4, c);
}

function drawAlternateCel(g, ox, oy, b, pose) {
  const o = color(b.outline), mid = color(b.body), light = color(b.light);
  if (pose === "type_paw" || pose === "type_intense") {
    // Swap the leading paw and illuminate alternating keyboard clusters.
    g.ellipse(ox + 39, oy + 72, 7, 6, o);
    g.ellipse(ox + 39, oy + 71, 5, 4, light);
    g.rect(ox + 48, oy + 78, 5, 2, pose === "type_intense" ? common.gold : common.blue);
    g.rect(ox + 58, oy + 78, 5, 2, pose === "type_intense" ? common.red : common.gold);
    if (pose === "type_intense") {
      g.ellipse(ox + 63, oy + 20, 4, 6, common.steam);
      g.ellipse(ox + 70, oy + 13, 3, 4, common.steam);
    }
  } else if (pose === "pet_happy") {
    drawHeart(g, ox + 18, oy + 18, common.blush);
    drawHeart(g, ox + 81, oy + 27, common.blush);
  } else if (pose === "tail_wag") {
    g.line(ox + 11, oy + 34, ox + 24, oy + 39, common.gold, 2);
    g.line(ox + 9, oy + 45, ox + 23, oy + 46, common.gold, 2);
  } else if (pose === "run") {
    g.ellipse(ox + 20, oy + 80, 8, 3, common.steam);
    g.line(ox + 5, oy + 50, ox + 20, oy + 50, common.steam, 2);
  } else if (pose === "paper_unroll") {
    g.rect(ox + 24, oy + 75, 16, 8, common.paper);
    g.line(ox + 27, oy + 80, ox + 38, oy + 80, shade(b.mark, 0.82), 1);
  } else if (pose === "drink") {
    g.rect(ox + 78, oy + 65, 2, 3, common.water);
    g.rect(ox + 82, oy + 61, 2, 2, common.water);
  } else if (pose === "sleep") {
    g.rect(ox + 68, oy + 22, 7, 2, common.blue);
    g.rect(ox + 77, oy + 16, 6, 2, common.blue);
  } else if (pose === "eat") {
    g.rect(ox + 38, oy + 75, 4, 3, common.gold);
    g.rect(ox + 47, oy + 73, 4, 3, common.gold);
  }
}

function drawCatCareCel(g, ox, oy, b, pose) {
  if (pose === "eat") {
    g.rect(ox + 34, oy + 75, 28, 7, common.red);
    g.rect(ox + 37, oy + 71, 22, 6, common.red);
    for (const x of [40, 47, 54]) g.rect(ox + x, oy + 72, 4, 3, common.gold);
  } else if (pose === "beg") {
    drawHeart(g, ox + 78, oy + 21, common.blush);
  }
}

function drawCharmAccents(g, ox, oy, b, name) {
  const sparkle = shade(b.light, 1.2);
  if (["pet_happy", "happy_jump", "tail_wag"].includes(name)) {
    drawHeart(g, ox + 78, oy + 20, common.blush);
    drawStar(g, ox + 21, oy + 29, sparkle);
  } else if (["look_up", "head_tilt", "focus_sit"].includes(name)) {
    drawStar(g, ox + 76, oy + 21, common.gold);
  } else if (name === "alert") {
    g.rect(ox + 76, oy + 18, 3, 11, common.gold);
    g.rect(ox + 76, oy + 32, 3, 3, common.gold);
  }
}

function drawTail(g, ox, oy, b, pose) {
  const o = color(b.outline), mid = color(b.body), light = color(b.light);
  const wag = pose === "tail_wag" ? 5 : pose === "drag" ? -3 : 0;
  if (b.tail === "curl") {
    g.ellipse(ox + 31, oy + 45 + wag, 14, 15, o);
    g.ellipse(ox + 32, oy + 45 + wag, 10, 11, light);
    g.ellipse(ox + 37, oy + 48 + wag, 6, 6, [0, 0, 0, 0]);
    g.ellipse(ox + 36, oy + 48 + wag, 4, 4, mid);
  } else if (b.tail === "plume") {
    g.ellipse(ox + 30, oy + 43 + wag, 10, 18, o);
    g.ellipse(ox + 30, oy + 43 + wag, 7, 15, light);
    g.line(ox + 29, oy + 31 + wag, ox + 39, oy + 48 + wag, shade(b.mark, 0.92), 2);
  } else if (b.tail === "sickle") {
    g.ellipse(ox + 30, oy + 42 + wag, 11, 16, o);
    g.ellipse(ox + 32, oy + 42 + wag, 8, 13, light);
    g.rect(ox + 30, oy + 45 + wag, 10, 13, [0, 0, 0, 0]);
  } else {
    g.line(ox + 27, oy + 52 + wag, ox + 12, oy + 57 + wag, o, 5);
    g.line(ox + 28, oy + 52 + wag, ox + 15, oy + 56 + wag, light, 3);
  }
}

function drawEars(g, ox, y, b, tilt) {
  const o = color(b.outline), mid = color(b.body), mark = color(b.mark);
  if (b.ears === "floppy") {
    g.ellipse(ox + 51 + tilt, y + 36, 8, 15, o);
    g.ellipse(ox + 52 + tilt, y + 37, 5, 12, mid);
    g.ellipse(ox + 78 + tilt, y + 37, 8, 14, o);
    g.ellipse(ox + 77 + tilt, y + 38, 5, 11, b.spots === "spots" ? mark : mid);
    return;
  }
  const tall = b.ears === "tall" ? -4 : b.ears === "small" ? 6 : 0;
  const leftTip = b.ears === "point" ? 17 : 13;
  const rightTip = b.ears === "point" ? 18 : 14;
  g.tri([ox + 50 + tilt, y + 31], [ox + 56 + tilt, y + leftTip + tall], [ox + 64 + tilt, y + 33], o);
  g.tri([ox + 53 + tilt, y + 30], [ox + 57 + tilt, y + leftTip + 7 + tall], [ox + 61 + tilt, y + 31], mid);
  g.tri([ox + 68 + tilt, y + 31], [ox + 76 + tilt, y + rightTip + tall], [ox + 81 + tilt, y + 34], o);
  g.tri([ox + 70 + tilt, y + 31], [ox + 75 + tilt, y + rightTip + 7 + tall], [ox + 78 + tilt, y + 33], mid);
  g.rect(ox + 55 + tilt, y + leftTip + tall, 3, 2, o);
  g.rect(ox + 75 + tilt, y + rightTip + tall, 3, 2, o);
}

function drawBreedMarks(g, ox, y, b, pose) {
  const mark = color(b.mark);
  if (b.spots === "mask") {
    g.rect(ox + 55, y + 35, 7, 5, mark);
    g.rect(ox + 70, y + 35, 7, 5, mark);
    g.line(ox + 60, y + 35, ox + 67, y + 43, mark, 2);
  } else if (b.spots === "saddle") {
    g.ellipse(ox + 39, y + 51, 17, 9, mark);
    g.rect(ox + 52, y + 33, 18, 6, mark);
  } else if (b.spots === "spots") {
    for (const [x, yy, r] of [[37, 53, 3], [48, 62, 2], [58, 50, 3], [72, 36, 2], [61, 44, 2]]) {
      g.ellipse(ox + x, y + yy, r, r, mark);
    }
  } else if (b.spots === "mane") {
    for (let i = 0; i < 9; i++) {
      g.rect(ox + 47 + i * 3, y + 47 + (i % 2), 3, 6, mark);
    }
  } else if (b.spots === "shag") {
    for (let i = 0; i < 8; i++) {
      g.line(ox + 42 + i * 5, y + 45, ox + 39 + i * 5, y + 56, mark, 1);
    }
  }
}

function drawPuppyPolish(g, ox, y, b, name, tilt) {
  const cute = ["idle", "sit", "sit_side", "stand", "look_up", "head_tilt", "pet_happy", "tail_wag", "pant"].includes(name);
  const cozy = ["sleep", "lie_down", "stretch"].includes(name);
  const cheekAlpha = name === "pet_happy" || name === "happy_jump" ? A : 180;

  if (cute && !["blink", "sleep"].includes(name)) {
    g.rect(ox + 52 + tilt, y + 45, 3, 2, [...common.blush.slice(0, 3), cheekAlpha]);
    g.rect(ox + 76 + tilt, y + 45, 3, 2, [...common.blush.slice(0, 3), cheekAlpha]);
  }

  if (!cozy) {
    g.put(ox + 66 + tilt, y + 47, common.shine);
    g.rect(ox + 30, y + 79, 2, 1, common.pad);
    g.rect(ox + 36, y + 79, 2, 1, common.pad);
    g.rect(ox + 57, y + 79, 2, 1, common.pad);
    g.rect(ox + 63, y + 79, 2, 1, common.pad);
  }

  if (name === "tail_wag" || name === "happy_jump") {
    g.rect(ox + 21, y + 33, 2, 2, shade(b.light, 1.18));
    g.rect(ox + 17, y + 38, 2, 2, shade(b.light, 1.18));
  }
}

function drawDog(g, ox, oy, b, name) {
  const o = color(b.outline);
  const dark = shade(b.body, 0.72);
  const mid = color(b.body);
  const light = color(b.light);
  const mark = color(b.mark);
  const low = ["sleep", "lie_down", "stretch"].includes(name);
  const jump = ["jump", "happy_jump"].includes(name);
  const drag = name === "drag";
  const fast = ["run", "chase", "zoomies"].includes(name);
  const tilt = name === "head_tilt" ? -5 : name === "side_eye" ? 3 : 0;
  const y = oy + (jump ? -10 : drag ? -7 : low ? 10 : 0);
  const scale = b.bodyScale;
  const stretch = fast ? 8 : name === "walk_b" ? -4 : 0;
  drawContactShadow(g, ox, oy, fast ? 31 : low ? 25 : 27);
  drawCharmAccents(g, ox, oy, b, name);

  if (name === "deliver_note") {
    g.rect(ox + 60, oy + 66, 20, 13, common.paper);
    g.rect(ox + 60, oy + 66, 20, 2, o);
    g.line(ox + 61, oy + 67, ox + 70, oy + 75, shade(b.mark, 0.82), 1);
    g.line(ox + 79, oy + 67, ox + 70, oy + 75, shade(b.mark, 0.82), 1);
  }
  if (name === "drink") {
    g.rect(ox + 58, oy + 75, 23, 5, common.blue);
    g.rect(ox + 61, oy + 70, 17, 7, common.blue);
    g.rect(ox + 63, oy + 72, 13, 2, common.water);
  }
  if (name === "eat") {
    g.rect(ox + 34, oy + 75, 28, 7, common.red);
    g.rect(ox + 37, oy + 71, 22, 6, common.red);
    for (const x of [40, 47, 54]) g.rect(ox + x, oy + 72, 4, 3, common.gold);
  }
  if (name === "beg") {
    drawHeart(g, ox + 78, oy + 21, common.blush);
    g.ellipse(ox + 76, oy + 62, 6, 7, o);
    g.ellipse(ox + 76, oy + 61, 4, 5, light);
  }
  if (name === "paper_unroll") {
    g.ellipse(ox + 72, oy + 73, 7, 5, o);
    g.ellipse(ox + 72, oy + 73, 4, 3, common.paper);
    g.rect(ox + 34, oy + 75, 38, 8, common.paper);
    g.rect(ox + 34, oy + 75, 38, 2, shade(b.mark, 0.82));
    g.line(ox + 39, oy + 80, ox + 64, oy + 80, shade(b.mark, 0.82), 1);
  }

  if (low) {
    g.ellipse(ox + 44, y + 56, 29 * scale + stretch, 15 + b.fluff * 0.2, o);
    g.ellipse(ox + 44, y + 55, 25 * scale + stretch, 12 + b.fluff * 0.15, mid);
    g.ellipse(ox + 65, y + 47, 19, 15, o);
    g.ellipse(ox + 65, y + 46, 16, 12, light);
  } else {
    drawTail(g, ox, y, b, name);
    g.ellipse(ox + 45, y + 59, 28 * scale + stretch, 17 + b.fluff * 0.3, o);
    g.ellipse(ox + 45, y + 58, 24 * scale + stretch, 13 + b.fluff * 0.25, mid);
    g.ellipse(ox + 50, y + 62, 14 * scale, 9, light);
    g.ellipse(ox + 64 + tilt, y + 41, 23 + b.fluff * 0.2, 20 + b.fluff * 0.2, o);
    g.ellipse(ox + 64 + tilt, y + 40, 20 + b.fluff * 0.15, 17 + b.fluff * 0.15, light);
    g.ellipse(ox + 66 + tilt, y + 50, 14, 9, shade(b.mark, 1.02));
  }

  drawEars(g, ox, y, b, tilt);
  drawBreedMarks(g, ox, y, b, name);

  g.ellipse(ox + 66 + tilt, y + 47, 8, 5, mark);
  g.ellipse(ox + 57 + tilt, y + 41, 5, 5, mark);

  const eyeY = name === "look_up" ? y + 35 : y + 39;
  const lx = ox + 57 + tilt, rx = ox + 72 + tilt;
  if (["blink", "pet_happy", "sleep"].includes(name)) {
    g.line(lx - 2, eyeY, lx + 2, eyeY, common.eye, 2);
    g.line(rx - 2, eyeY, rx + 2, eyeY, common.eye, 2);
  } else if (name === "side_eye") {
    g.rect(lx - 3, eyeY, 6, 2, common.eye);
    g.rect(rx - 3, eyeY, 6, 2, common.eye);
  } else {
    g.rect(lx - 2, eyeY - 2, 5, 6, common.eye);
    g.rect(rx - 2, eyeY - 2, 5, 6, common.eye);
    g.rect(lx - 1, eyeY - 1, 2, 2, common.shine);
    g.rect(rx - 1, eyeY - 1, 2, 2, common.shine);
    g.rect(lx + 1, eyeY + 3, 2, 1, shade(b.mark, 1.25));
    g.rect(rx + 1, eyeY + 3, 2, 1, shade(b.mark, 1.25));
  }
  if (["pet_happy", "happy_jump"].includes(name)) {
    g.rect(ox + 52 + tilt, y + 45, 3, 2, common.blush);
    g.rect(ox + 76 + tilt, y + 45, 3, 2, common.blush);
  }
  g.rect(ox + 66 + tilt, y + 49, 4, 3, common.eye);
  g.rect(ox + 65 + tilt, y + 52, 2, 1, common.eye);
  drawPuppyPolish(g, ox, y, b, name, tilt);
  if (name === "bark" || name === "yawn") g.rect(ox + 68 + tilt, y + 51, name === "yawn" ? 7 : 5, 5, common.eye);
  else g.rect(ox + 67 + tilt, y + 54, 4, 1, common.eye);

  g.rect(ox + 53, y + 52, 22, 4, common.red);
  g.rect(ox + 63, y + 55, 5, 5, common.gold);

  const legY = y + (low ? 63 : 67);
  const dangle = drag ? 8 : 0;
  const stride = fast ? 8 : name === "walk_a" ? 4 : name === "walk_b" ? -4 : 0;
  g.rect(ox + 31 - stride, legY, 8, 11 + dangle, o);
  g.rect(ox + 32 - stride, legY, 5, 9 + dangle, dark);
  g.rect(ox + 56 + stride, legY, 8, 11 + dangle, o);
  g.rect(ox + 57 + stride, legY, 5, 9 + dangle, dark);
  g.rect(ox + 28 - stride, legY + 9 + dangle, 13, 5, o);
  g.rect(ox + 53 + stride, legY + 9 + dangle, 13, 5, o);
  g.rect(ox + 31 - stride, legY + 10 + dangle, 8, 2, light);
  g.rect(ox + 56 + stride, legY + 10 + dangle, 8, 2, light);

  if (name === "type_paw" || name === "type_intense") {
    g.rect(ox + 27, oy + 78, 43, 6, o);
    g.rect(ox + 29, oy + 77, 39, 5, [72, 83, 101, A]);
    if (name === "type_intense") {
      g.ellipse(ox + 75, oy + 24, 4, 6, common.steam);
      g.ellipse(ox + 82, oy + 18, 3, 4, common.steam);
      g.rect(ox + 56, y + 39, 3, 3, [170, 54, 48, A]);
      g.rect(ox + 70, y + 39, 3, 3, [170, 54, 48, A]);
    }
  }
  if (name === "pant") {
    g.rect(ox + 70 + tilt, y + 52, 4, 8, common.tongue);
    g.ellipse(ox + 77, oy + 28, 3, 4, [110, 181, 230, A]);
  }
  if (name === "bark") {
    g.line(ox + 79, y + 45, ox + 88, y + 41, common.gold, 2);
    g.line(ox + 80, y + 51, ox + 89, y + 55, common.gold, 2);
  }
  if (name === "sleep") {
    g.rect(ox + 72, oy + 26, 8, 2, common.blue);
    g.rect(ox + 80, oy + 20, 7, 2, common.blue);
    g.rect(ox + 86, oy + 14, 6, 2, common.blue);
  }
  if (name === "land") {
    g.ellipse(ox + 31, oy + 81, 9, 3, common.steam);
    g.ellipse(ox + 63, oy + 82, 10, 3, common.steam);
  }
  if (name === "scratch") g.line(ox + 39, oy + 67, ox + 27, oy + 50, dark, 4);
  if (name === "zoomies") {
    g.line(ox + 8, oy + 43, ox + 24, oy + 43, common.steam, 2);
    g.line(ox + 5, oy + 54, ox + 22, oy + 54, common.steam, 2);
    g.line(ox + 12, oy + 65, ox + 27, oy + 65, common.steam, 2);
  }
}

function drawCatTail(g, ox, oy, b, name) {
  const o = color(b.outline), mid = color(b.body), light = color(b.light);
  const wag = name === "tail_wag" ? Math.round(Math.sin((ox + oy + 1) / 19) * 4) : 0;
  const curl = b.tail === "cat-curl";
  if (curl) {
    g.line(ox + 31, oy + 58 + wag, ox + 22, oy + 43 + wag, o, 5);
    g.line(ox + 22, oy + 43 + wag, ox + 33, oy + 32 + wag, o, 5);
    g.line(ox + 32, oy + 58 + wag, ox + 24, oy + 43 + wag, light, 3);
    g.line(ox + 24, oy + 43 + wag, ox + 32, oy + 35 + wag, light, 3);
    return;
  }
  g.line(ox + 30, oy + 59 + wag, ox + 14, oy + 51 + wag, o, 5);
  g.line(ox + 14, oy + 51 + wag, ox + 11, oy + 37 + wag, o, 5);
  g.line(ox + 31, oy + 59 + wag, ox + 16, oy + 51 + wag, light, 3);
  g.line(ox + 16, oy + 51 + wag, ox + 13, oy + 39 + wag, light, 3);
}

function drawCatMarks(g, ox, y, b, name) {
  const mark = color(b.mark);
  if (b.spots === "calico") {
    g.ellipse(ox + 55, y + 40, 7, 7, mark);
    g.ellipse(ox + 73, y + 35, 8, 8, shade(b.mark, 0.76));
    g.ellipse(ox + 44, y + 58, 9, 6, mark);
  } else if (b.spots === "moon") {
    g.rect(ox + 62, y + 31, 6, 2, mark);
    g.rect(ox + 61, y + 34, 8, 2, mark);
    g.rect(ox + 64, y + 37, 3, 2, mark);
    g.rect(ox + 47, y + 61, 8, 3, shade(b.mark, 0.82));
  } else if (b.spots === "tabby") {
    for (const x of [56, 62, 68]) g.line(ox + x, y + 30, ox + x - 2, y + 36, mark, 1);
    g.line(ox + 42, y + 55, ox + 56, y + 58, mark, 2);
    g.line(ox + 38, y + 62, ox + 51, y + 64, mark, 2);
  }
  if (name === "side_eye") g.rect(ox + 75, y + 42, 3, 2, mark);
}

function drawCat(g, ox, oy, b, name) {
  const o = color(b.outline);
  const dark = shade(b.body, 0.68);
  const mid = color(b.body);
  const light = color(b.light);
  const mark = color(b.mark);
  const low = ["sleep", "lie_down", "stretch"].includes(name);
  const jump = ["jump", "happy_jump"].includes(name);
  const drag = name === "drag";
  const fast = ["run", "chase", "zoomies"].includes(name);
  const tilt = name === "head_tilt" ? -4 : name === "side_eye" ? 3 : 0;
  const y = oy + (jump ? -10 : drag ? -7 : low ? 10 : 0);
  const stretch = fast ? 7 : name === "walk_b" ? -3 : 0;
  drawContactShadow(g, ox, oy, fast ? 29 : low ? 24 : 26);
  drawCharmAccents(g, ox, oy, b, name);

  if (name === "deliver_note") {
    g.rect(ox + 58, oy + 67, 21, 12, common.paper);
    g.rect(ox + 58, oy + 67, 21, 2, o);
    g.line(ox + 59, oy + 68, ox + 69, oy + 75, shade(b.mark, 0.82), 1);
    g.line(ox + 78, oy + 68, ox + 69, oy + 75, shade(b.mark, 0.82), 1);
  }
  if (name === "drink") {
    g.rect(ox + 57, oy + 76, 23, 5, common.blue);
    g.rect(ox + 60, oy + 71, 17, 7, common.blue);
    g.rect(ox + 62, oy + 73, 13, 2, common.water);
  }
  if (name === "paper_unroll") {
    g.ellipse(ox + 72, oy + 74, 7, 5, o);
    g.ellipse(ox + 72, oy + 74, 4, 3, common.paper);
    g.rect(ox + 34, oy + 76, 38, 8, common.paper);
    g.rect(ox + 34, oy + 76, 38, 2, shade(b.mark, 0.82));
    g.line(ox + 39, oy + 81, ox + 64, oy + 81, shade(b.mark, 0.82), 1);
  }

  if (low) {
    g.ellipse(ox + 44, y + 58, 27 + stretch, 13, o);
    g.ellipse(ox + 44, y + 57, 23 + stretch, 10, mid);
    g.ellipse(ox + 65, y + 49, 19, 14, o);
    g.ellipse(ox + 65, y + 48, 16, 11, light);
  } else {
    drawCatTail(g, ox, y, b, name);
    g.ellipse(ox + 45, y + 60, 25 + stretch, 15, o);
    g.ellipse(ox + 45, y + 59, 21 + stretch, 12, mid);
    g.ellipse(ox + 50, y + 63, 13, 8, light);
    g.ellipse(ox + 64 + tilt, y + 41, 22, 19, o);
    g.ellipse(ox + 64 + tilt, y + 40, 19, 16, light);
    g.ellipse(ox + 66 + tilt, y + 50, 13, 8, shade(b.light, 1.02));
  }

  g.tri([ox + 50 + tilt, y + 32], [ox + 55 + tilt, y + 16], [ox + 64 + tilt, y + 33], o);
  g.tri([ox + 53 + tilt, y + 31], [ox + 56 + tilt, y + 23], [ox + 61 + tilt, y + 32], mid);
  g.tri([ox + 68 + tilt, y + 33], [ox + 77 + tilt, y + 17], [ox + 81 + tilt, y + 35], o);
  g.tri([ox + 71 + tilt, y + 32], [ox + 76 + tilt, y + 24], [ox + 78 + tilt, y + 34], mid);
  drawCatMarks(g, ox, y, b, name);

  const eyeY = name === "look_up" ? y + 35 : y + 40;
  const lx = ox + 57 + tilt, rx = ox + 72 + tilt;
  if (["blink", "pet_happy", "sleep"].includes(name)) {
    g.line(lx - 3, eyeY, lx + 3, eyeY, common.eye, 2);
    g.line(rx - 3, eyeY, rx + 3, eyeY, common.eye, 2);
  } else if (name === "side_eye") {
    g.rect(lx - 3, eyeY, 6, 2, common.eye);
    g.rect(rx - 3, eyeY, 6, 2, common.eye);
  } else {
    g.rect(lx - 2, eyeY - 2, 5, 6, common.eye);
    g.rect(rx - 2, eyeY - 2, 5, 6, common.eye);
    g.rect(lx - 1, eyeY - 1, 2, 2, common.shine);
    g.rect(rx - 1, eyeY - 1, 2, 2, common.shine);
    g.rect(lx + 1, eyeY + 3, 2, 1, shade(b.mark, 1.3));
    g.rect(rx + 1, eyeY + 3, 2, 1, shade(b.mark, 1.3));
  }

  if (!["blink", "sleep"].includes(name)) {
    g.rect(ox + 51 + tilt, y + 46, 3, 2, common.blush);
    g.rect(ox + 77 + tilt, y + 46, 3, 2, common.blush);
  }
  g.rect(ox + 66 + tilt, y + 50, 3, 2, common.eye);
  if (name === "bark" || name === "yawn") g.rect(ox + 67 + tilt, y + 53, name === "yawn" ? 7 : 5, 5, common.eye);
  else g.rect(ox + 67 + tilt, y + 55, 2, 1, common.eye);

  for (const wy of [49, 53]) {
    g.line(ox + 58 + tilt, y + wy, ox + 47 + tilt, y + wy - 3, shade(b.mark, 0.82), 1);
    g.line(ox + 73 + tilt, y + wy, ox + 84 + tilt, y + wy - 3, shade(b.mark, 0.82), 1);
  }

  g.rect(ox + 54, y + 53, 20, 4, common.red);
  g.rect(ox + 64, y + 56, 4, 5, common.gold);

  const legY = y + (low ? 64 : 68);
  const dangle = drag ? 8 : 0;
  const stride = fast ? 7 : name === "walk_a" ? 4 : name === "walk_b" ? -4 : 0;
  g.rect(ox + 32 - stride, legY, 7, 10 + dangle, o);
  g.rect(ox + 33 - stride, legY, 4, 8 + dangle, dark);
  g.rect(ox + 56 + stride, legY, 7, 10 + dangle, o);
  g.rect(ox + 57 + stride, legY, 4, 8 + dangle, dark);
  g.rect(ox + 29 - stride, legY + 8 + dangle, 12, 4, o);
  g.rect(ox + 53 + stride, legY + 8 + dangle, 12, 4, o);

  if (name === "type_paw" || name === "type_intense") {
    g.rect(ox + 27, oy + 78, 43, 6, o);
    g.rect(ox + 29, oy + 77, 39, 5, [72, 83, 101, A]);
    if (name === "type_intense") {
      g.ellipse(ox + 75, oy + 24, 4, 6, common.steam);
      g.ellipse(ox + 82, oy + 18, 3, 4, common.steam);
    }
  }
  if (name === "pant") g.rect(ox + 70 + tilt, y + 54, 4, 7, common.tongue);
  if (name === "bark") {
    g.line(ox + 79, y + 45, ox + 88, y + 41, common.gold, 2);
    g.line(ox + 80, y + 51, ox + 89, y + 55, common.gold, 2);
  }
  if (name === "sleep") {
    g.rect(ox + 72, oy + 26, 8, 2, common.blue);
    g.rect(ox + 80, oy + 20, 7, 2, common.blue);
    g.rect(ox + 86, oy + 14, 6, 2, common.blue);
  }
  if (name === "land") {
    g.ellipse(ox + 31, oy + 81, 9, 3, common.steam);
    g.ellipse(ox + 63, oy + 82, 10, 3, common.steam);
  }
  if (name === "scratch") g.line(ox + 39, oy + 68, ox + 29, oy + 51, dark, 4);
  if (name === "zoomies") {
    g.line(ox + 8, oy + 43, ox + 24, oy + 43, common.steam, 2);
    g.line(ox + 5, oy + 54, ox + 22, oy + 54, common.steam, 2);
    g.line(ox + 12, oy + 65, ox + 27, oy + 65, common.steam, 2);
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
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
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

function generateBreed(breed) {
  const rows = Math.ceil(FRAMES.length / COLS);
  const width = COLS * CELL, height = rows * CELL;
  const g = createCanvas(width, height);
  const meta = {
    canvas: { width: CELL, height: CELL },
    grid: { cols: COLS, rows },
    frames: {},
  };
  FRAMES.forEach((name, index) => {
    const x = (index % COLS) * CELL;
    const y = Math.floor(index / COLS) * CELL;
    meta.frames[name] = { x, y, w: CELL, h: CELL, index };
    const alternate = name.endsWith("_alt");
    const pose = alternate ? name.slice(0, -4) : name;
    if (breed.species === "cat") {
      drawCat(g, x, y, breed, pose);
      drawCatCareCel(g, x, y, breed, pose);
    } else drawDog(g, x, y, breed, pose);
    if (alternate) drawAlternateCel(g, x, y, breed, pose);
  });

  const dir = `art/exported/${breed.id}`;
  mkdirSync(dir, { recursive: true });
  writePng(`${dir}/atlas.png`, width, height, g.data);
  writeFileSync(`${dir}/atlas.json`, JSON.stringify(meta, null, 2) + "\n");
  writeFileSync(`${dir}/manifest.json`, JSON.stringify({
    schemaVersion: 1,
    id: breed.id,
    name: breed.name,
    author: breed.author,
    license: "CC-BY-4.0",
    species: breed.species === "cat" ? "cat" : "dog",
    canvas: meta.canvas,
    frames: meta.frames,
  }, null, 2) + "\n");
  return { breed, meta, png: `${dir}/atlas.png`, json: `${dir}/atlas.json` };
}

const generated = BREEDS.map(generateBreed);
const shiba = generated.find(x => x.breed.id === "shiba-inu");
mkdirSync("art/placeholder", { recursive: true });
writeFileSync("art/placeholder/shiba_placeholder.json", JSON.stringify(shiba.meta, null, 2) + "\n");
writeFileSync("art/placeholder/shiba_placeholder.png", await import("node:fs").then(fs => fs.readFileSync(shiba.png)));

console.log(`wrote ${generated.length} breed atlases with ${FRAMES.length} poses each`);
for (const g of generated) console.log(`- ${g.breed.id}: ${g.png}`);
