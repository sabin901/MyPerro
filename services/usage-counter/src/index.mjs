const DAY = 24 * 60 * 60;
const RETENTION_SECONDS = 400 * DAY;

function responseJson(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export function validateHeartbeat(value) {
  if (!value || typeof value !== "object") return null;
  const { installationId, appVersion, platform, architecture } = value;
  if (typeof installationId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(installationId)) return null;
  if (typeof appVersion !== "string" || !/^[0-9A-Za-z.+-]{1,40}$/.test(appVersion)) return null;
  if (!new Set(["windows", "macos", "linux"]).has(platform)) return null;
  if (typeof architecture !== "string" || !/^[0-9A-Za-z_-]{1,32}$/.test(architecture)) return null;
  return { installationId, appVersion, platform, architecture };
}

async function installationHash(installationId, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(installationId));
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
}

async function sameSecret(left, right) {
  const encode = value => new TextEncoder().encode(value ?? "");
  const [a, b] = await Promise.all([crypto.subtle.digest("SHA-256", encode(left)), crypto.subtle.digest("SHA-256", encode(right))]);
  const av = new Uint8Array(a);
  const bv = new Uint8Array(b);
  let different = av.length ^ bv.length;
  for (let index = 0; index < Math.min(av.length, bv.length); index++) different |= av[index] ^ bv[index];
  return different === 0;
}

async function readSmallJson(request) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 2048) return null;
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function heartbeat(request, env) {
  const payload = validateHeartbeat(await readSmallJson(request));
  if (!payload) return responseJson({ error: "invalid heartbeat" }, 400);
  if (!env.INSTALLATION_HASH_SECRET || env.INSTALLATION_HASH_SECRET.length < 32) {
    return responseJson({ error: "service not configured" }, 503);
  }
  const idHash = await installationHash(payload.installationId, env.INSTALLATION_HASH_SECRET);
  const now = Math.floor(Date.now() / 1000);
  await env.USAGE_DB.prepare(`
    INSERT INTO installations (id_hash, platform, architecture, app_version, first_seen, last_seen)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id_hash) DO UPDATE SET
      platform = excluded.platform,
      architecture = excluded.architecture,
      app_version = excluded.app_version,
      last_seen = excluded.last_seen
  `).bind(idHash, payload.platform, payload.architecture, payload.appVersion, now, now).run();
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}

async function removeInstallation(request, env) {
  const raw = await readSmallJson(request);
  if (!raw || typeof raw.installationId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw.installationId)) {
    return responseJson({ error: "invalid deletion request" }, 400);
  }
  if (!env.INSTALLATION_HASH_SECRET || env.INSTALLATION_HASH_SECRET.length < 32) {
    return responseJson({ error: "service not configured" }, 503);
  }
  const idHash = await installationHash(raw.installationId, env.INSTALLATION_HASH_SECRET);
  await env.USAGE_DB.prepare("DELETE FROM installations WHERE id_hash = ?").bind(idHash).run();
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}

async function statistics(request, env) {
  const authorization = request.headers.get("authorization") ?? "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!env.STATS_TOKEN || !(await sameSecret(supplied, env.STATS_TOKEN))) {
    return responseJson({ error: "unauthorized" }, 401);
  }

  const now = Math.floor(Date.now() / 1000);
  const [summary, platforms, versions] = await env.USAGE_DB.batch([
    env.USAGE_DB.prepare(`
      SELECT
        COUNT(*) AS total_installations,
        COALESCE(SUM(CASE WHEN last_seen >= ? THEN 1 ELSE 0 END), 0) AS active_24h,
        COALESCE(SUM(CASE WHEN last_seen >= ? THEN 1 ELSE 0 END), 0) AS active_7d,
        COALESCE(SUM(CASE WHEN last_seen >= ? THEN 1 ELSE 0 END), 0) AS active_30d
      FROM installations
    `).bind(now - DAY, now - 7 * DAY, now - 30 * DAY),
    env.USAGE_DB.prepare(`
      SELECT platform, COUNT(*) AS active_30d
      FROM installations WHERE last_seen >= ? GROUP BY platform ORDER BY platform
    `).bind(now - 30 * DAY),
    env.USAGE_DB.prepare(`
      SELECT app_version, COUNT(*) AS active_30d
      FROM installations WHERE last_seen >= ? GROUP BY app_version ORDER BY active_30d DESC LIMIT 12
    `).bind(now - 30 * DAY),
  ]);
  return responseJson({
    generatedAt: new Date(now * 1000).toISOString(),
    ...summary.results[0],
    platforms: platforms.results,
    versions: versions.results,
    definition: "One opted-in installation is active when its last anonymous heartbeat falls inside the selected window.",
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") {
      return responseJson({ status: "ok" });
    }
    if (url.pathname === "/v1/heartbeat" && request.method === "POST") return heartbeat(request, env);
    if (url.pathname === "/v1/heartbeat" && request.method === "DELETE") return removeInstallation(request, env);
    if (url.pathname === "/v1/stats" && request.method === "GET") return statistics(request, env);
    return responseJson({ error: "not found" }, 404);
  },

  async scheduled(_event, env) {
    const cutoff = Math.floor(Date.now() / 1000) - RETENTION_SECONDS;
    await env.USAGE_DB.prepare("DELETE FROM installations WHERE last_seen < ?").bind(cutoff).run();
  },
};
