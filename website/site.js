const RELEASE_TAG = "v0.9.0-rc.8";
const RELEASE_ROOT = `https://github.com/sabin901/MyPerro/releases/download/${RELEASE_TAG}`;
const DOWNLOADS = {
  windows: `${RELEASE_ROOT}/MyPerro_0.9.0-rc.8_x64-setup.exe`,
  "mac-arm": `${RELEASE_ROOT}/MyPerro_0.9.0-rc.8_aarch64.dmg`,
  "mac-intel": `${RELEASE_ROOT}/MyPerro_0.9.0-rc.8_x64.dmg`,
  "linux-appimage": `${RELEASE_ROOT}/MyPerro_0.9.0-rc.8_amd64.AppImage`,
  "linux-deb": `${RELEASE_ROOT}/MyPerro_0.9.0-rc.8_amd64.deb`,
};

const companions = [
  ["shiba-inu", "Shiba Inu", "Bright & curious"],
  ["pomeranian", "Pomeranian", "Tiny & confident"],
  ["husky", "Husky", "Chatty & adventurous"],
  ["german-shepherd", "German Shepherd", "Loyal & watchful"],
  ["dalmatian", "Dalmatian", "Playful & spirited"],
  ["lhasa-apso", "Lhasa Apso", "Gentle & dignified"],
  ["calico-cat", "Calico Cat", "Clever & affectionate"],
  ["midnight-cat", "Midnight Cat", "Quiet & mysterious"],
  ["cream-tabby", "Cream Tabby", "Cozy & easygoing"],
];

const grid = document.querySelector("#companionGrid");
for (const [id, name, nature] of companions) {
  const card = document.createElement("article");
  card.className = "companion-card";
  const image = document.createElement("img");
  image.src = `./pets/${id}.png`;
  image.alt = `${name} desktop companion`;
  image.width = 192;
  image.height = 192;
  if (id !== "shiba-inu") image.loading = "lazy";
  const heading = document.createElement("h3");
  heading.textContent = name;
  const description = document.createElement("p");
  description.textContent = nature;
  card.append(image, heading, description);
  grid?.append(card);
}

for (const link of document.querySelectorAll(".download-link")) {
  const asset = link.dataset.asset;
  if (asset && DOWNLOADS[asset]) {
    link.href = DOWNLOADS[asset];
    link.rel = "noopener";
  }
}

function currentPlatform() {
  const value = `${navigator.userAgent} ${navigator.platform}`.toLowerCase();
  if (value.includes("win")) return "windows";
  if (value.includes("mac")) return "mac-arm";
  if (value.includes("linux")) return "linux";
  return null;
}

const platform = currentPlatform();
if (platform) {
  const card = document.querySelector(`[data-platform="${platform}"]`);
  card?.classList.add("is-device");
  const hero = document.querySelector("#heroDownload");
  const preferredAsset = platform === "linux" ? "linux-appimage" : platform;
  if (hero && DOWNLOADS[preferredAsset]) {
    hero.href = DOWNLOADS[preferredAsset];
    hero.querySelector("span").textContent = platform === "windows"
      ? "Download for Windows"
      : platform === "linux" ? "Download for Linux" : "Download for Mac";
  }
}

const canvas = document.querySelector("#heroPet");
const context = canvas?.getContext("2d", { alpha: true });
const note = document.querySelector(".desktop-note");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
let atlas;
let sheet;
let demo = "roam";
let demoStarted = performance.now();

const demos = {
  roam: { frames: ["head_tilt", "walk_a", "walk_b", "walk_a", "sit_side"], frameMs: 220, note: "A quiet walk across the desktop." },
  type: { frames: ["type_paw", "type_paw_alt", "type_intense", "type_intense_alt"], frameMs: 135, note: "Keeping company while you work." },
  snack: { frames: ["eat", "eat_alt", "eat", "happy_jump", "land", "tail_wag"], frameMs: 220, note: "Dinner, followed by a small celebration." },
  roll: { frames: ["head_tilt", "play", "pet_happy", "play", "land", "tail_wag"], frameMs: 170, note: "A run, a tumble, and a tidy landing." },
  sleep: { frames: ["lie_down", "sleep", "sleep_alt", "sleep"], frameMs: 700, note: "One minute of rest, unless gently woken." },
};

for (const button of document.querySelectorAll("[data-demo]")) {
  button.addEventListener("click", () => {
    demo = button.dataset.demo;
    demoStarted = performance.now();
    for (const item of document.querySelectorAll("[data-demo]")) {
      item.setAttribute("aria-pressed", String(item === button));
    }
    if (note) note.textContent = demos[demo].note;
  });
}

async function loadHero() {
  if (!canvas || !context) return;
  const [metadata, image] = await Promise.all([
    fetch("./pets/hero-atlas.json").then(response => {
      if (!response.ok) throw new Error("Could not load companion metadata");
      return response.json();
    }),
    new Promise((resolve, reject) => {
      const value = new Image();
      value.onload = () => resolve(value);
      value.onerror = () => reject(new Error("Could not load companion artwork"));
      value.src = "./pets/hero-atlas.png";
    }),
  ]);
  atlas = metadata;
  sheet = image;
  requestAnimationFrame(drawHero);
}

function drawHero(now) {
  if (!canvas || !context || !atlas || !sheet) return;
  const recipe = demos[demo];
  const elapsed = now - demoStarted;
  const frameName = reducedMotion ? recipe.frames[0] : recipe.frames[Math.floor(elapsed / recipe.frameMs) % recipe.frames.length];
  const frame = atlas.frames[frameName] ?? atlas.frames.idle;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.drawImage(sheet, frame.x, frame.y, frame.w, frame.h, 0, 0, canvas.width, canvas.height);

  if (!reducedMotion) {
    let x = 0;
    let y = 0;
    let rotation = 0;
    let scaleX = 1;
    if (demo === "roam") {
      const trip = (elapsed % 6800) / 6800;
      x = Math.sin(trip * Math.PI) * 145;
      scaleX = trip > .5 ? -1 : 1;
      y = Math.sin(elapsed / 180) * 2;
    } else if (demo === "roll") {
      const trip = (elapsed % 2600) / 2600;
      x = trip * 125;
      rotation = trip * 720;
      y = -Math.max(0, Math.sin(trip * Math.PI * 3) * 24);
    } else if (demo === "type") {
      y = Math.sin(elapsed / 70) * 3;
    } else if (demo === "snack") {
      y = -Math.max(0, Math.sin(elapsed / 430 * Math.PI) * 10);
    } else if (demo === "sleep") {
      const breath = 1 + Math.sin(elapsed / 500) * .012;
      canvas.style.scale = `${breath}`;
    }
    if (demo !== "sleep") canvas.style.scale = "1";
    canvas.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${rotation}deg) scaleX(${scaleX})`;
  }
  requestAnimationFrame(drawHero);
}

loadHero().catch(() => {
  if (note) note.textContent = "The companion preview could not load.";
});
