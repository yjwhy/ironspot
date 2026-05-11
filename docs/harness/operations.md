# Operations Playbook

Runtime concerns that live outside the codebase: external accounts, secrets, post-deploy smoke procedures, rotation cadence. Created during Task 31; extended as new operational surfaces land.

## External accounts (one-time setup)

### Sentry (2 projects)

Per Task 31 decision #5 app and API are tracked separately so dashboards stay readable.

1. Sign in / create Sentry org at https://sentry.io (Generate Zero Platform organisation).
2. Create project `ironspot-app` (platform: React Native) → copy DSN → set `EXPO_PUBLIC_SENTRY_DSN` on the EAS build profile and any local `.env` that needs symbolicated events.
3. Create project `ironspot-api` (platform: Java / Spring Boot) → copy DSN → set `SENTRY_DSN` on Railway env (and local `iron-spot-api/.env` if exercising the path locally).
4. Sentry → User → Account → Auth Tokens → create a token with scope `project:releases` → set `SENTRY_AUTH_TOKEN` on EAS build env (used by `@sentry/expo-upload-sourcemaps`; never bundled into the app).
5. Set environments in both projects: `development`, `production`. Default sample rates per decision #11 are wired in code; adjust in dashboard if quota becomes a concern.

DSN-empty contract: both `src/shared/lib/sentry.ts` (`initSentry`) and `iron-spot-api/src/main/java/com/ironspot/common/monitoring/SentryConfig.java` skip init entirely when DSN is blank, so unset values fail open (no traffic) rather than crashing.

### Slack admin moderation channel

1. Slack workspace → create or reuse `#ironspot-moderation` channel.
2. Apps → search "Incoming Webhooks" → Add to Slack → choose `#ironspot-moderation` → copy webhook URL.
3. Set `SLACK_ADMIN_WEBHOOK_URL` on Railway. Empty value = `AdminNotificationService` log-only no-op (intentional fail-open).
4. Owner: assign one engineer + a backup as listed below under "Rotation".

## Railway environment checklist (Spring Boot)

Set on the Railway service that runs `iron-spot-api`. Missing required values will fail startup loudly.

| Variable                       | Required? | Source                                                   |
| ------------------------------ | --------- | -------------------------------------------------------- |
| `DATABASE_URL`                 | Yes       | Railway Postgres plugin                                  |
| `DATABASE_USERNAME`            | Yes       | Railway Postgres plugin                                  |
| `DATABASE_PASSWORD`            | Yes       | Railway Postgres plugin                                  |
| `SUPABASE_JWT_SECRET`          | Yes       | Supabase dashboard → Auth → JWT Settings                 |
| `SUPABASE_URL`                 | Yes       | Supabase project URL                                     |
| `SUPABASE_SERVICE_ROLE_KEY`    | Yes       | Supabase service role (keep server-only)                 |
| `GOOGLE_VISION_API_KEY`        | Yes       | GCP project → Vision API key                             |
| `NAVER_SEARCH_CLIENT_ID`       | Yes       | developers.naver.com 지역검색 앱                         |
| `NAVER_SEARCH_CLIENT_SECRET`   | Yes       | developers.naver.com 지역검색 앱                         |
| `SENTRY_DSN`                   | No        | Sentry → ironspot-api project → Client Keys              |
| `SLACK_ADMIN_WEBHOOK_URL`      | No        | Slack incoming webhook for #ironspot-moderation          |
| `IRONSPOT_SLACK_SMOKE_ENABLED` | No        | `false` permanently. Toggle to `true` only during smoke. |
| `SPRING_PROFILES_ACTIVE`       | Yes       | `prod`                                                   |

## Post-deploy smoke procedures (Task 32 timing)

### Sentry app

1. EAS build with TestFlight / internal track; install on a real device.
2. Add a "throw test" button gated by an env flag so it cannot ship by accident: render it only when `__DEV__` is false AND `process.env.EXPO_PUBLIC_SENTRY_SMOKE === 'true'`. The button's onPress calls `throw new Error("ironspot sentry smoke " + Date.now())`. Mirrors the server `IRONSPOT_SLACK_SMOKE_ENABLED` toggle pattern.
3. Build with `EXPO_PUBLIC_SENTRY_SMOKE=true`, install, press once → Sentry dashboard → `ironspot-app` project → confirm the event appears with a symbolicated stack (sourcemap upload working) and `environment: production`.
4. Rebuild without the flag for any subsequent prod build. Leaving the button code in the bundle is fine; it just never renders.

### Sentry server

1. With prod profile booted on Railway, temporarily unset `DATABASE_URL` or hit an endpoint that triggers a deliberate `RuntimeException` (e.g. a `/api/_admin/throw` you add then revert).
2. Confirm the event appears in Sentry dashboard → `ironspot-api` project with `environment: production`.
3. Re-set the env var / revert the throw endpoint.

### Slack 3-path smoke (replaces "4 throwaway accounts" approach)

1. On Railway: set `IRONSPOT_SLACK_SMOKE_ENABLED=true` → trigger redeploy → wait until health check is green.
2. Obtain a valid JWT (Supabase Auth — any authenticated user works).
3. Run three curls:

   ```bash
   API=https://your-railway-url
   AUTH="Authorization: Bearer $JWT"
   curl -X POST -H "$AUTH" "$API/api/_admin/slack-smoke/urgent"
   curl -X POST -H "$AUTH" "$API/api/_admin/slack-smoke/autoblind"
   curl -X POST -H "$AUTH" "$API/api/_admin/slack-smoke/safesearch"
   ```

4. Confirm 3 messages arrive in `#ironspot-moderation`. Each carries the sentinel photo id ending `aa` so an operator can tell at a glance it is a smoke run, not a real event.
5. On Railway: set `IRONSPOT_SLACK_SMOKE_ENABLED=false` → trigger redeploy. Verify a subsequent curl returns `404`.

If a path fails to deliver: check Railway env (`SLACK_ADMIN_WEBHOOK_URL` present and matches Slack's current URL for the channel), then Slack's incoming-webhook config (channel not archived, app not revoked).

## Rotation

| Resource                   | Owner (primary) | Backup | Cadence                                 |
| -------------------------- | --------------- | ------ | --------------------------------------- |
| Slack incoming webhook     | TBD             | TBD    | Rotate every 90 days                    |
| Sentry auth token          | TBD             | TBD    | Rotate every 180 days                   |
| Sentry DSN (app + api)     | —               | —      | Public, rotate on project deletion only |
| Supabase service-role key  | TBD             | TBD    | Rotate on incident only                 |
| Naver Search client/secret | TBD             | TBD    | Rotate on incident only                 |

Fill in `TBD` once the team / on-call schedule is decided.

## Known caveats

- Jest emits `A worker process has failed to exit gracefully` after the suite when `@sentry/react-native` was loaded (Sentry's internal timer/native bridge). Exit code is still 0; this is benign and can be ignored unless CI starts failing.
- Sentry app source maps require `pnpm expo prebuild` and the Sentry Expo plugin (registered in `app.json`) to be present in the bundle. Re-run prebuild any time `app.json` plugins change.
- `@sentry/react-native@8.9.2` is pinned exact (no caret) because 8.10+ has an iOS `AVAssetDownloadURLSession` crash (`getsentry/sentry-react-native#7886`). Re-evaluate the pin every quarter; bump only after upstream confirms a fix.
