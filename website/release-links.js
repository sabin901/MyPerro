export const FALLBACK_RELEASE = {
  tag: "v0.9.0-rc.12",
  downloads: {
    windows: "https://github.com/sabin901/Pawi/releases/download/v0.9.0-rc.12/Pawi_0.9.0-rc.12_x64-setup.exe",
    "mac-arm": "https://github.com/sabin901/Pawi/releases/download/v0.9.0-rc.12/Pawi_0.9.0-rc.12_aarch64.dmg",
    "mac-intel": "https://github.com/sabin901/Pawi/releases/download/v0.9.0-rc.12/Pawi_0.9.0-rc.12_x64.dmg",
    "linux-appimage": "https://github.com/sabin901/Pawi/releases/download/v0.9.0-rc.12/Pawi_0.9.0-rc.12_amd64.AppImage",
    "linux-deb": "https://github.com/sabin901/Pawi/releases/download/v0.9.0-rc.12/Pawi_0.9.0-rc.12_amd64.deb",
  },
};

export function releaseApiUrl(tag = FALLBACK_RELEASE.tag) {
  return `https://api.github.com/repos/sabin901/Pawi/releases/tags/${encodeURIComponent(tag)}`;
}

const ASSET_PATTERNS = {
  windows: /_x64-setup\.exe$/i,
  "mac-arm": /_aarch64\.dmg$/i,
  "mac-intel": /_x64\.dmg$/i,
  "linux-appimage": /_amd64\.AppImage$/i,
  "linux-deb": /_amd64\.deb$/i,
};

export function platformFamily(userAgent = "", navigatorPlatform = "") {
  const value = `${userAgent} ${navigatorPlatform}`.toLowerCase();
  if (value.includes("win")) return "windows";
  // Safari does not expose a trustworthy Intel/Apple-silicon distinction.
  // Never guess here: the wrong DMG cannot boot on an Intel Mac.
  if (value.includes("mac")) return "mac";
  if (value.includes("linux")) return "linux";
  return null;
}

export function downloadsFromRelease(release) {
  const assets = Array.isArray(release?.assets) ? release.assets : [];
  const downloads = {};
  for (const [key, pattern] of Object.entries(ASSET_PATTERNS)) {
    const asset = assets.find(candidate => pattern.test(candidate?.name ?? ""));
    if (asset?.browser_download_url) downloads[key] = asset.browser_download_url;
  }
  return {
    tag: typeof release?.tag_name === "string" ? release.tag_name : FALLBACK_RELEASE.tag,
    downloads: { ...FALLBACK_RELEASE.downloads, ...downloads },
  };
}
