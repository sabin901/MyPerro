import { FALLBACK_RELEASE, downloadsFromRelease, platformFamily } from "./release-links.js";

let releaseInfo = FALLBACK_RELEASE;

const companions = [
  { id: "shiba-inu", name: "Shiba Inu", nature: "Bright & curious", description: "An alert little shadow for busy days—quick to wander, tilt its head, and celebrate the smallest bit of attention." },
  { id: "pomeranian", name: "Pomeranian", nature: "Tiny & confident", description: "A pocket-sized spark with a proud stride, lively hops, and a tail that rarely remembers how to stay still." },
  { id: "husky", name: "Husky", nature: "Chatty & adventurous", description: "An expressive explorer who asks for company, roams with purpose, and has something cheerful to say about snack time." },
  { id: "german-shepherd", name: "German Shepherd", nature: "Loyal & watchful", description: "A calm, dependable presence that keeps an eye on the room, stays close while you work, and settles when you do." },
  { id: "dalmatian", name: "Dalmatian", nature: "Playful & spirited", description: "A high-spirited friend made for quick runs, comic tumbles, eager play, and a very enthusiastic welcome back." },
  { id: "lhasa-apso", name: "Lhasa Apso", nature: "Gentle & dignified", description: "A thoughtful little companion with an unhurried manner, soft reactions, and a dignified appreciation for attention." },
  { id: "calico-cat", name: "Calico Cat", nature: "Clever & affectionate", description: "A bright, independent cat who watches first, wanders second, and saves its warmest reactions for a well-timed pet." },
  { id: "midnight-cat", name: "Midnight Cat", nature: "Quiet & mysterious", description: "A subtle night-coloured observer that moves softly, rests nearby, and turns curiosity into small moments of mischief." },
  { id: "cream-tabby", name: "Cream Tabby", nature: "Cozy & easygoing", description: "A mellow desktop neighbour happiest near the workday—stretching, snoozing, and quietly asking when dinner might happen." },
];

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

function applyReleaseLinks() {
  for (const link of document.querySelectorAll(".download-link")) {
    const asset = link.dataset.asset;
    if (asset && releaseInfo.downloads[asset]) {
      link.href = releaseInfo.downloads[asset];
      link.rel = "noopener";
    }
  }
  const version = document.querySelector("#releaseVersion");
  if (version) version.textContent = releaseInfo.tag;
}

const platform = platformFamily(navigator.userAgent, navigator.platform);
function applyPlatformRecommendation() {
  const hero = document.querySelector("#heroDownload");
  if (!hero || !platform) return;
  if (platform === "mac") {
    document.querySelectorAll('[data-platform^="mac-"]').forEach(row => row.classList.add("is-device-family"));
    hero.href = "#download";
    hero.querySelector("span").textContent = "Choose your Mac build";
    return;
  }
  const row = document.querySelector(`[data-platform="${platform}"]`);
  row?.classList.add("is-device");
  const preferredAsset = platform === "linux" ? "linux-appimage" : platform;
  if (releaseInfo.downloads[preferredAsset]) {
    hero.href = releaseInfo.downloads[preferredAsset];
    hero.querySelector("span").textContent = platform === "windows" ? "Download for Windows" : "Download for Linux";
  }
}

applyReleaseLinks();
applyPlatformRecommendation();
fetch("https://api.github.com/repos/sabin901/MyPerro/releases/latest", {
  headers: { Accept: "application/vnd.github+json" },
})
  .then(response => response.ok ? response.json() : Promise.reject(new Error(`GitHub returned ${response.status}`)))
  .then(release => {
    releaseInfo = downloadsFromRelease(release);
    applyReleaseLinks();
    applyPlatformRecommendation();
  })
  .catch(() => {});

const companionRail = document.querySelector("#companionRail");
const spotlightImage = document.querySelector("#spotlightImage");
const spotlightCanvas = document.querySelector("#spotlightCanvas");
const spotlightContext = spotlightCanvas?.getContext("2d", { alpha: true });
const spotlightNumber = document.querySelector("#spotlightNumber");
const spotlightNature = document.querySelector("#spotlightNature");
const spotlightName = document.querySelector("#spotlightName");
const spotlightDescription = document.querySelector("#spotlightDescription");
const companionPosition = document.querySelector("#companionPosition");
const requestedCompanion = new URLSearchParams(location.search).get("pet");
const requestedIndex = companions.findIndex(companion => companion.id === requestedCompanion);
let companionIndex = requestedIndex >= 0 ? requestedIndex : 0;
let companionMotion = "idle";
let companionMotionStarted = performance.now();
let spotlightSheet;
let spotlightLoadToken = 0;
let activeCompanionTransition;

const companionMotions = {
  idle: { frames: [0, 0, 1, 0, 2, 0, 0], frameMs: 360 },
  walk: { frames: [3, 4], frameMs: 210 },
  celebrate: { frames: [5, 6, 7, 2], frameMs: 220 },
};

function twoDigits(value) {
  return String(value).padStart(2, "0");
}

function updateCompanion(index, moveFocus = false) {
  companionIndex = (index + companions.length) % companions.length;
  const companion = companions[companionIndex];
  const commit = () => {
    spotlightImage.src = `./pets/${companion.id}.png`;
    spotlightImage.alt = `${companion.name} desktop companion`;
    spotlightImage.classList.remove("is-hidden");
    spotlightImage.removeAttribute("aria-hidden");
    spotlightCanvas?.classList.remove("is-ready");
    if (spotlightCanvas) spotlightCanvas.setAttribute("aria-label", `Animated ${companion.name} desktop companion`);
    spotlightNumber.textContent = twoDigits(companionIndex + 1);
    spotlightNature.textContent = companion.nature;
    spotlightName.textContent = companion.name;
    spotlightDescription.textContent = companion.description;
    companionPosition.textContent = `${twoDigits(companionIndex + 1)} / ${twoDigits(companions.length)}`;
    for (const [tabIndex, tab] of [...companionRail.children].entries()) {
      const selected = tabIndex === companionIndex;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      tab.classList.toggle("is-active", selected);
    }
  };

  let updateReady = Promise.resolve();
  if (!reducedMotion && document.startViewTransition && document.readyState === "complete") {
    activeCompanionTransition?.skipTransition();
    const transition = document.startViewTransition(commit);
    activeCompanionTransition = transition;
    transition.ready.catch(() => {});
    transition.finished.catch(() => {}).finally(() => {
      if (activeCompanionTransition === transition) activeCompanionTransition = undefined;
    });
    updateReady = transition.updateCallbackDone;
  } else {
    commit();
  }

  if (moveFocus) companionRail.children[companionIndex]?.focus();
  const nextUrl = new URL(location.href);
  nextUrl.searchParams.set("pet", companion.id);
  history.replaceState({}, "", nextUrl);
  updateReady.then(() => loadSpotlightMotion(companion)).catch(() => {
    spotlightCanvas?.classList.remove("is-ready");
    spotlightImage.classList.remove("is-hidden");
    spotlightImage.removeAttribute("aria-hidden");
  });
}

async function loadSpotlightMotion(companion) {
  if (!spotlightCanvas || !spotlightContext) return;
  const token = ++spotlightLoadToken;
  const image = await new Promise((resolve, reject) => {
    const value = new Image();
    value.onload = () => resolve(value);
    value.onerror = reject;
    value.src = `./pets/${companion.id}-motion.png`;
  });
  if (token !== spotlightLoadToken) return;
  spotlightSheet = image;
  companionMotionStarted = performance.now();
  spotlightCanvas.classList.add("is-ready");
  spotlightImage.classList.add("is-hidden");
  spotlightImage.setAttribute("aria-hidden", "true");
}

function drawSpotlight(now) {
  if (spotlightCanvas && spotlightContext && spotlightSheet) {
    const recipe = companionMotions[companionMotion];
    const elapsed = now - companionMotionStarted;
    const frameIndex = reducedMotion ? recipe.frames[0] : recipe.frames[Math.floor(elapsed / recipe.frameMs) % recipe.frames.length];
    const frameSize = spotlightSheet.height;
    spotlightContext.clearRect(0, 0, spotlightCanvas.width, spotlightCanvas.height);
    spotlightContext.imageSmoothingEnabled = true;
    spotlightContext.drawImage(
      spotlightSheet,
      frameIndex * frameSize,
      0,
      frameSize,
      frameSize,
      0,
      0,
      spotlightCanvas.width,
      spotlightCanvas.height,
    );
  }
  requestAnimationFrame(drawSpotlight);
}

for (const [index, companion] of companions.entries()) {
  const tab = document.createElement("button");
  tab.className = "companion-tab";
  tab.type = "button";
  tab.id = `companion-${companion.id}`;
  tab.setAttribute("role", "tab");
  tab.setAttribute("aria-controls", "companionPanel");
  tab.setAttribute("aria-selected", String(index === companionIndex));
  tab.tabIndex = index === companionIndex ? 0 : -1;
  tab.innerHTML = `<img src="./pets/${companion.id}.png" width="56" height="56" alt="" ${index > 2 ? "loading=\"lazy\"" : ""}><span><small>${twoDigits(index + 1)}</small>${companion.name}</span>`;
  tab.addEventListener("click", () => updateCompanion(index));
  tab.addEventListener("keydown", event => {
    let nextIndex;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = companionIndex + 1;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = companionIndex - 1;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = companions.length - 1;
    if (nextIndex === undefined) return;
    event.preventDefault();
    updateCompanion(nextIndex, true);
  });
  companionRail?.append(tab);
}

document.querySelector("#previousCompanion")?.addEventListener("click", () => updateCompanion(companionIndex - 1));
document.querySelector("#nextCompanion")?.addEventListener("click", () => updateCompanion(companionIndex + 1));

for (const button of document.querySelectorAll("[data-companion-motion]")) {
  button.addEventListener("click", () => {
    companionMotion = button.dataset.companionMotion;
    companionMotionStarted = performance.now();
    for (const item of document.querySelectorAll("[data-companion-motion]")) {
      item.setAttribute("aria-pressed", String(item === button));
    }
  });
}

const companionSize = document.querySelector("#companionSize");
const companionSizeValue = document.querySelector("#companionSizeValue");
const companionPanel = document.querySelector("#companionPanel");
companionSize?.addEventListener("input", () => {
  const scale = Number(companionSize.value) / 100;
  companionPanel?.style.setProperty("--companion-preview-scale", String(scale));
  companionSizeValue.textContent = `${companionSize.value}%`;
});

let companionSwipeStart;
companionPanel?.addEventListener("pointerdown", event => {
  companionSwipeStart = { x: event.clientX, y: event.clientY };
});
companionPanel?.addEventListener("pointerup", event => {
  if (!companionSwipeStart) return;
  const xDistance = event.clientX - companionSwipeStart.x;
  const yDistance = event.clientY - companionSwipeStart.y;
  companionSwipeStart = undefined;
  if (Math.abs(xDistance) < 54 || Math.abs(xDistance) < Math.abs(yDistance)) return;
  updateCompanion(companionIndex + (xDistance < 0 ? 1 : -1));
});

updateCompanion(companionIndex);
requestAnimationFrame(drawSpotlight);

const canvas = document.querySelector("#heroPet");
const context = canvas?.getContext("2d", { alpha: true });
const note = document.querySelector(".desktop-note");
let atlas;
let sheet;
let demo = "roam";
let demoStarted = performance.now();
let noteTimer;

const demos = {
  roam: { frames: ["head_tilt", "walk_a", "walk_b", "walk_a", "sit_side"], frameMs: 220, note: "A quiet walk across the desktop." },
  type: { frames: ["type_paw", "type_paw_alt", "type_intense", "type_intense_alt"], frameMs: 135, note: "Keeping company while you work." },
  snack: { frames: ["eat", "eat_alt", "eat", "happy_jump", "land", "tail_wag"], frameMs: 220, note: "Dinner, followed by a small celebration." },
  roll: { frames: ["head_tilt", "play", "pet_happy", "play", "land", "tail_wag"], frameMs: 170, note: "A run, a tumble, and a tidy landing." },
  sleep: { frames: ["lie_down", "sleep", "sleep_alt", "sleep"], frameMs: 700, note: "One minute of rest, unless gently woken." },
};

function changeDemoNote(message) {
  if (!note) return;
  clearTimeout(noteTimer);
  if (reducedMotion) {
    note.textContent = message;
    return;
  }
  note.classList.add("is-changing");
  noteTimer = setTimeout(() => {
    note.textContent = message;
    note.classList.remove("is-changing");
  }, 130);
}

for (const button of document.querySelectorAll("[data-demo]")) {
  button.addEventListener("click", () => {
    demo = button.dataset.demo;
    demoStarted = performance.now();
    for (const item of document.querySelectorAll("[data-demo]")) {
      item.setAttribute("aria-pressed", String(item === button));
    }
    changeDemoNote(demos[demo].note);
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

loadHero().catch(() => changeDemoNote("The companion preview could not load."));

const dayImage = document.querySelector("#dayImage");
const dayTime = document.querySelector("#dayTime");
const dayLabel = document.querySelector("#dayLabel");
const dayWhisper = document.querySelector("#dayWhisper");
const dayChapters = [...document.querySelectorAll("[data-day-moment]")];
let dayTimer;

function setDayMoment(chapter) {
  if (!chapter || chapter.classList.contains("is-current")) return;
  dayChapters.forEach(item => item.classList.toggle("is-current", item === chapter));
  clearTimeout(dayTimer);
  dayImage?.classList.add("is-changing");
  dayTimer = setTimeout(() => {
    if (dayImage) {
      const companion = companions.find(item => item.id === chapter.dataset.dayImage);
      dayImage.src = `./pets/${chapter.dataset.dayImage}.png`;
      dayImage.alt = `${companion?.name ?? "MyPerro"} desktop companion`;
      dayImage.classList.remove("is-changing");
    }
    if (dayTime) dayTime.textContent = chapter.dataset.dayTime;
    if (dayLabel) dayLabel.textContent = chapter.dataset.dayLabel;
    if (dayWhisper) dayWhisper.textContent = chapter.dataset.dayWhisper;
  }, reducedMotion ? 0 : 145);
}

if ("IntersectionObserver" in window) {
  const dayObserver = new IntersectionObserver(entries => {
    const current = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (current) setDayMoment(current.target);
  }, { rootMargin: "-30% 0px -30%", threshold: [.15, .35, .6] });
  dayChapters.forEach(chapter => dayObserver.observe(chapter));
}

const menuToggle = document.querySelector("#menuToggle");
const siteNavigation = document.querySelector("#siteNavigation");
function closeMenu() {
  siteNavigation?.classList.remove("is-open");
  menuToggle?.setAttribute("aria-expanded", "false");
}
menuToggle?.addEventListener("click", () => {
  const open = !siteNavigation?.classList.contains("is-open");
  siteNavigation?.classList.toggle("is-open", open);
  menuToggle.setAttribute("aria-expanded", String(open));
});
siteNavigation?.querySelectorAll("a").forEach(link => link.addEventListener("click", closeMenu));
addEventListener("keydown", event => {
  if (event.key === "Escape") closeMenu();
});

const revealItems = document.querySelectorAll("[data-reveal]");
if (!reducedMotion && "IntersectionObserver" in window) {
  document.body.classList.add("motion-ready");
  const revealObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("is-visible");
      revealObserver.unobserve(entry.target);
    }
  }, { threshold: .12, rootMargin: "0px 0px -40px" });
  requestAnimationFrame(() => revealItems.forEach(item => revealObserver.observe(item)));
} else {
  revealItems.forEach(item => item.classList.add("is-visible"));
}

const header = document.querySelector("#siteHeader");
const progress = document.querySelector("#pageProgress");
let scrollQueued = false;

function updateScrollState() {
  const available = document.documentElement.scrollHeight - innerHeight;
  const amount = available > 0 ? Math.min(1, scrollY / available) : 0;
  progress?.style.setProperty("--page-progress", String(amount));
  header?.classList.toggle("is-scrolled", scrollY > 12);
  scrollQueued = false;
}

addEventListener("scroll", () => {
  if (scrollQueued) return;
  scrollQueued = true;
  requestAnimationFrame(updateScrollState);
}, { passive: true });
updateScrollState();

const observedSections = ["companions", "life", "privacy", "community", "download"]
  .map(id => document.getElementById(id))
  .filter(Boolean);
if ("IntersectionObserver" in window) {
  const sectionObserver = new IntersectionObserver(entries => {
    const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    for (const link of document.querySelectorAll("[data-section-link]")) {
      const active = link.dataset.sectionLink === visible.target.id;
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    }
  }, { rootMargin: "-20% 0px -65%", threshold: [0, .2, .5] });
  observedSections.forEach(section => sectionObserver.observe(section));
}
