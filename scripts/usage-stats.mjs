const endpoint = process.env.IPET_USAGE_STATS_URL;
const token = process.env.IPET_USAGE_STATS_TOKEN;
if (!endpoint || !token) {
  console.error("Set IPET_USAGE_STATS_URL and IPET_USAGE_STATS_TOKEN first.");
  process.exit(1);
}

const response = await fetch(endpoint, { headers: { authorization: `Bearer ${token}` } });
if (!response.ok) throw new Error(`Statistics request failed with HTTP ${response.status}`);
const stats = await response.json();
console.table([{
  "Total opted-in installations": stats.total_installations,
  "Active today": stats.active_24h,
  "Active 7 days": stats.active_7d,
  "Active 30 days": stats.active_30d,
}]);
console.table(stats.platforms);
console.table(stats.versions);
