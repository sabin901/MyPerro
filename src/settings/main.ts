/**
 * Settings window logic.
 *
 * Reads the saved settings, fills the form, and writes them back on save. The
 * validation lives in settings.ts (`normaliseSettings`), so this file only has
 * to move values between the DOM and the object — it never has to trust them.
 */

import { loadSettings, saveSettings } from "../pet/store";
import { BREED_PRESETS, BUILT_IN_BREEDS, normaliseSettings, type Settings } from "../pet/settings";

const $ = <T extends HTMLElement = HTMLInputElement>(id: string) =>
  document.getElementById(id) as T;
const preview = $("breedPreview") as HTMLCanvasElement;
const pctx = preview.getContext("2d", { alpha: true })!;
pctx.imageSmoothingEnabled = false;
let previewRun = 0;

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

  ($("soundEnabled") as HTMLInputElement).checked = s.soundEnabled;
  ($("peekMode") as HTMLInputElement).checked = s.peekMode;
  ($("reducedMotion") as HTMLInputElement).checked = s.reducedMotion;
  ($("startAtLogin") as HTMLInputElement).checked = s.startAtLogin;
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
    quietFrom: int("quietFrom"),
    quietTo: int("quietTo"),
    pomodoro: {
      focusMinutes: int("focusMinutes"),
      breakMinutes: int("breakMinutes"),
      longBreakMinutes: int("longBreakMinutes"),
      roundsBeforeLongBreak: int("roundsBeforeLongBreak"),
    },
    soundEnabled: checked("soundEnabled"),
    peekMode: checked("peekMode"),
    reducedMotion: checked("reducedMotion"),
    startAtLogin: checked("startAtLogin"),
    appearance: {
      breed: ($("breed") as HTMLSelectElement).value,
      baseColor: text("baseColor"),
      markingColor: text("markingColor"),
      markingStyle: ($("markingStyle") as HTMLSelectElement).value,
      collarColor: text("collarColor"),
    },
  });
}

async function main() {
  fill(await loadSettings());
  void drawPreview();

  for (const id of ["baseColor", "markingColor", "markingStyle", "collarColor"]) {
    $(id).addEventListener("input", () => { void drawPreview(); });
    $(id).addEventListener("change", () => { void drawPreview(); });
  }
  $("breed").addEventListener("input", () => applyBreed(($("breed") as HTMLSelectElement).value));
  $("breed").addEventListener("change", () => applyBreed(($("breed") as HTMLSelectElement).value));

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
    const saved = await saveSettings(collect());
    fill(saved);                         // reflect any clamping back to the user
    const badge = $("saved");
    badge.classList.add("show");
    setTimeout(() => badge.classList.remove("show"), 1400);
  });
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
    button.innerHTML = `<em>${preset.species}</em><strong>${preset.label}</strong><small>${preset.petName}</small>`;
    button.addEventListener("click", () => applyBreed(id));
    host.appendChild(button);
  }
}

function setReminderPreset(stretchOn: boolean, stretchMinutes: number, waterOn: boolean, waterMinutes: number) {
  ($("stretchEnabled") as HTMLInputElement).checked = stretchOn;
  ($("stretchEveryMinutes") as HTMLInputElement).value = String(stretchMinutes);
  ($("waterEnabled") as HTMLInputElement).checked = waterOn;
  ($("waterEveryMinutes") as HTMLInputElement).value = String(waterMinutes);
}

function setPomodoroPreset(focus: number, shortBreak: number, longBreak: number, rounds: number) {
  ($("focusMinutes") as HTMLInputElement).value = String(focus);
  ($("breakMinutes") as HTMLInputElement).value = String(shortBreak);
  ($("longBreakMinutes") as HTMLInputElement).value = String(longBreak);
  ($("roundsBeforeLongBreak") as HTMLInputElement).value = String(rounds);
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
}

async function drawPreview() {
  const run = ++previewRun;
  const settings = collect();
  const breed = settings.appearance.breed;
  pctx.clearRect(0, 0, preview.width, preview.height);
  const [atlas, img] = await Promise.all([
    fetch(`/exported/${breed}/atlas.json`).then(r => r.json()),
    loadImage(`/exported/${breed}/atlas.png`),
  ]).catch(() => [null, null] as const);
  if (run !== previewRun) return;
  const frame = atlas?.frames?.idle;
  if (!frame || !img) return;
  pctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);
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
