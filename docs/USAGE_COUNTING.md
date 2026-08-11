# Optional active-install counting

MyPerro can report the number of opted-in installations that are active today,
over 7 days, and over 30 days. This is deliberately not a count of identifiable
people: one person can install on multiple computers, reinstalling creates a new
ID, and people who leave the option off are not counted.

## Privacy model

- Consent is explicit and off by default in onboarding and Settings.
- The client sends at most once every 24 hours.
- The payload has exactly four fields: random installation ID, app version,
  operating system, and CPU architecture.
- Local activity, names, settings, files, URLs, window information, and typed
  content never enter this request.
- The Worker HMAC-hashes the random ID before D1 storage. The raw ID is not
  stored on the server.
- Opting out sends a deletion request. If offline, the client retains the
  random ID and retries; it does not send more heartbeats.
- Records inactive for 400 days are removed by a daily scheduled job.
- Worker observability is disabled. The Worker code and D1 schema do not record
  IP addresses or user agents. Cloudflare still necessarily processes network
  metadata while delivering requests.

The endpoint is intentionally absent from ordinary source builds. With no
`IPET_USAGE_ENDPOINT` at compile time, the feature remains inert even if a user
selects it.

## One-time Cloudflare setup

Install/login with Wrangler and create the D1 database:

```powershell
npx wrangler login
Set-Location services/usage-counter
npx wrangler d1 create ipet-usage
```

Copy the returned database ID into `services/usage-counter/wrangler.toml`, then
apply the migration:

```powershell
npx wrangler d1 migrations apply ipet-usage --remote
```

Create two different random secrets of at least 32 characters and enter them
when prompted. Keep the statistics token private.

```powershell
npx wrangler secret put INSTALLATION_HASH_SECRET
npx wrangler secret put STATS_TOKEN
npx wrangler deploy
```

Verify the deployment:

```powershell
Invoke-RestMethod https://YOUR-WORKER.workers.dev/health
```

In GitHub repository Settings → Secrets and variables → Actions → Variables,
create `IPET_USAGE_ENDPOINT` with this value:

```text
https://YOUR-WORKER.workers.dev/v1/heartbeat
```

Only installers compiled after that variable is set can report heartbeats. The
CI release workflow passes the variable to every Windows, macOS, and Linux
build. For a local production build, set the same environment variable before
running `npm run release`.

## Read the aggregate count

Set the protected statistics endpoint and the private token in the current
PowerShell session, then run the included report:

```powershell
$env:IPET_USAGE_STATS_URL = "https://YOUR-WORKER.workers.dev/v1/stats"
$env:IPET_USAGE_STATS_TOKEN = "YOUR_PRIVATE_STATS_TOKEN"
npm run usage:stats
```

The report shows total opted-in installations and active 24-hour, 7-day, and
30-day counts, plus aggregate platform and version splits. Never put the stats
token into the website, app binary, repository, or a GitHub variable.

## Operational limits

This is a useful product-health estimate, not an identity system or billing
meter. Because the public heartbeat endpoint must accept first contact from a
new app installation, a determined attacker can inflate the count. GitHub asset
download totals remain a separate measure of package downloads, not users.

Run the protocol tests with:

```powershell
npm run usage:test
```
