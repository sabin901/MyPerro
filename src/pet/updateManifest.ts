const REQUIRED_UPDATE_PLATFORMS = [
  "darwin-aarch64", "darwin-x86_64", "windows-x86_64", "linux-x86_64",
] as const;

export interface UpdateManifestResult { ok: boolean; errors: string[] }

export function validateUpdateManifest(raw: unknown, expectedVersion?: string): UpdateManifestResult {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object") return { ok: false, errors: ["manifest must be an object"] };
  const value = raw as Record<string, unknown>;
  const version = typeof value.version === "string" ? value.version : "";
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) errors.push("version is not valid semantic versioning");
  if (expectedVersion && version !== expectedVersion) errors.push(`expected version ${expectedVersion}, received ${version || "missing"}`);
  if (!value.pub_date || Number.isNaN(Date.parse(String(value.pub_date)))) errors.push("pub_date is invalid");
  const platforms = value.platforms as Record<string, unknown> | undefined;
  for (const platform of REQUIRED_UPDATE_PLATFORMS) {
    const entry = platforms?.[platform] as Record<string, unknown> | undefined;
    if (!entry) { errors.push(`missing ${platform}`); continue; }
    const url = typeof entry.url === "string" ? entry.url : "";
    if (!url.startsWith("https://github.com/") || !url.includes(`/releases/download/v${version}/`)) {
      errors.push(`${platform} URL does not target the versioned GitHub release`);
    }
    if (typeof entry.signature !== "string" || entry.signature.trim().length < 40) {
      errors.push(`${platform} updater signature is missing or too short`);
    }
  }
  return { ok: errors.length === 0, errors };
}
