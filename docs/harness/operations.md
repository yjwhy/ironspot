# Operations Playbook

Runtime concerns that live outside the codebase: external accounts, secrets, post-deploy smoke procedures, rotation cadence. Created during Task 31; extended as new operational surfaces land.

## External accounts (one-time setup)

### Sentry (2 projects)

Per Task 31 decision #5 app and API are tracked separately so dashboards stay readable.

1. Sign in / create Sentry org at https://sentry.io (Generate Zero Platform organisation).
2. Create project `ironspot-app` (platform: React Native) → copy DSN → set `EXPO_PUBLIC_SENTRY_DSN` on the EAS build profile and any local `.env` that needs symbolicated events.
3. Create project `ironspot-api` (platform: Java / Spring Boot) → copy DSN → set `SENTRY_DSN` on the Render service environment (and local `iron-spot-api/.env` if exercising the path locally).
4. Sentry → User → Account → Auth Tokens → create a token with scope `project:releases` → set `SENTRY_AUTH_TOKEN` on EAS build env (used by `@sentry/expo-upload-sourcemaps`; never bundled into the app).
5. Set environments in both projects: `development`, `production`. Default sample rates per decision #11 are wired in code; adjust in dashboard if quota becomes a concern.

DSN-empty contract: both `src/shared/lib/sentry.ts` (`initSentry`) and `iron-spot-api/src/main/java/com/ironspot/common/monitoring/SentryConfig.java` skip init entirely when DSN is blank, so unset values fail open (no traffic) rather than crashing.

### Slack admin moderation channel

1. Slack workspace → create or reuse `#ironspot-moderation` channel.
2. Apps → search "Incoming Webhooks" → Add to Slack → choose `#ironspot-moderation` → copy webhook URL.
3. Set `SLACK_ADMIN_WEBHOOK_URL` on the Render service environment. Empty value = `AdminNotificationService` log-only no-op (intentional fail-open).
4. Owner: assign one engineer + a backup as listed below under "Rotation".

## Render service configuration (Spring Boot)

Per Task 32 decision #7, Spring Boot runs on Render's free Web Service tier. One-time provisioning steps below; the env table follows.

### One-time service creation

1. https://render.com → sign in (GitHub SSO recommended for repo wiring).
2. **New + → Web Service** → select the `ironspot` GitHub repo. Approve Render's GitHub App access if prompted.
3. Service settings:
   - **Name**: `ironspot` (becomes the URL host: `https://ironspot.onrender.com`).
   - **Region**: Singapore for the closest Asia presence (Korea has no Render region).
   - **Branch**: `main` after PR merge; `task/32b-live-verify` during verify.
   - **Root Directory**: `iron-spot-api`.
   - **Runtime**: Docker (auto-detected from `iron-spot-api/Dockerfile`).
   - **Instance Type**: **Free**.
   - **Auto-Deploy**: On (deploys on every push to the selected branch).
4. Add the env vars from the table below in **Environment** tab. The Spring Boot multi-stage Dockerfile build + first deploy takes 5~10 minutes; Render runs the health check at `/actuator/health` once the service starts listening on `$PORT` (Render injects `PORT=10000` by default; Spring Boot's `server.port: 8080` works because Render maps externally regardless, but matching Render's `$PORT` is safest if issues arise).

### Render service environment variables

Set in the Render dashboard, **Environment** tab. Missing required values fail startup loudly.

| Variable                        | Required? | Source                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                  | Yes       | Supabase Postgres (pooler URL, e.g. `jdbc:postgresql://aws-<N>-<region>.pooler.supabase.com:6543/postgres?prepareThreshold=0&sslmode=require`). The cluster prefix `<N>` (0, 1, ...) is project-specific — copy the exact hostname from Supabase Dashboard → Connect → Direct → Transaction pooler. `sslmode=require` is mandatory (pgbouncer rejects plaintext with a misleading "ENOTFOUND tenant/user" error). |
| `DATABASE_USERNAME`             | Yes       | Supabase project Postgres credentials (`postgres.<ref>`)                                                                                                                                                                                                                                                                                                                                                          |
| `DATABASE_PASSWORD`             | Yes       | Supabase project Postgres credentials                                                                                                                                                                                                                                                                                                                                                                             |
| `SUPABASE_JWKS_URL`             | Yes       | `https://<project>.supabase.co/auth/v1/.well-known/jwks.json` — Supabase migrated from HS256 shared secret to ECC P-256 (ES256) signed by per-project keys. `NimbusJwtDecoder` fetches and caches the JWKS in-process.                                                                                                                                                                                            |
| `SUPABASE_URL`                  | Yes       | Supabase project URL                                                                                                                                                                                                                                                                                                                                                                                              |
| `SUPABASE_SERVICE_ROLE_KEY`     | Yes       | Supabase service role (keep server-only)                                                                                                                                                                                                                                                                                                                                                                          |
| `GOOGLE_VISION_API_KEY`         | Yes       | GCP project, Vision API key                                                                                                                                                                                                                                                                                                                                                                                       |
| `NAVER_SEARCH_CLIENT_ID`        | Yes       | developers.naver.com 지역검색 앱                                                                                                                                                                                                                                                                                                                                                                                  |
| `NAVER_SEARCH_CLIENT_SECRET`    | Yes       | developers.naver.com 지역검색 앱                                                                                                                                                                                                                                                                                                                                                                                  |
| `GROQ_API_KEY`                  | Yes       | console.groq.com API key (`gsk_...`). Phase 3 NL Search primary LLM. Empty value short-circuits `GroqLlamaClient` to `LlmException(TRANSPORT)` so `FallbackLlmClient` can hand off to Gemini.                                                                                                                                                                                                                     |
| `GEMINI_API_KEY`                | Yes       | aistudio.google.com API key (`AIza...`). Phase 3 NL Search fallback LLM via `gemini-flash-lite-latest`.                                                                                                                                                                                                                                                                                                           |
| `SENTRY_DSN`                    | No        | Sentry, ironspot-api project, Client Keys                                                                                                                                                                                                                                                                                                                                                                         |
| `SLACK_ADMIN_WEBHOOK_URL`       | No        | Slack incoming webhook for #ironspot-moderation                                                                                                                                                                                                                                                                                                                                                                   |
| `IRONSPOT_SLACK_SMOKE_ENABLED`  | No        | `false` permanently. Toggle to `true` only during smoke.                                                                                                                                                                                                                                                                                                                                                          |
| `IRONSPOT_SENTRY_SMOKE_ENABLED` | No        | `false` permanently. Toggle to `true` only during the Task 32b Sentry server verify, then back to `false`.                                                                                                                                                                                                                                                                                                        |
| `SPRING_PROFILES_ACTIVE`        | Yes       | `prod`                                                                                                                                                                                                                                                                                                                                                                                                            |

DB choice rationale (Task 32 decision #2): Spring Boot uses the Supabase Postgres directly via the pgbouncer transaction-mode pooler rather than a managed Postgres on the hosting platform. This keeps Supabase as the single source of truth for migrations and removes a schema export/import step. The `?prepareThreshold=0` query parameter on `DATABASE_URL` disables JDBC server-side prepared statements, required for compatibility with PgBouncer's transaction pooling. The `&sslmode=require` query parameter forces TLS for the connection; without it pgbouncer rejects the handshake and returns a confusing `(ENOTFOUND) tenant/user postgres.<ref> not found` error that looks like a username/tenant mismatch. HikariCP `maximum-pool-size` is set to 5 in `application-prod.yml` to leave heap headroom for the 512MB Render free instance and to stay inside Supabase's free-tier pgbouncer connection limit.

### Keep-warm strategy (Render free 15-min idle sleep)

Render free Web Service spins down after 15 minutes of inactivity. Cold start for Spring Boot 4 on Render's 0.1 vCPU + 512MB tier is 30~90 seconds, which is unacceptable for user-facing requests. External keep-warm ping every 5 minutes prevents the sleep.

Recommended: **UptimeRobot free monitor** (no card, no time limit).

1. https://uptimerobot.com sign up (email only).
2. Add New Monitor → **Monitor Type: HTTP(S)** → URL: `https://ironspot.onrender.com/actuator/health` → Interval: **5 minutes** → Save.
3. Bonus: configure email alerts on the monitor for downtime visibility.

Fallback if UptimeRobot ever degrades: a GitHub Actions cron workflow runs `curl --max-time 30 <render-url>/actuator/health` every 10 minutes. GitHub Actions cron can be skipped under high platform load, so it's a backup rather than the primary mechanism.

## EAS build secrets (preview-simulator profile)

Set on the EAS project via `pnpm dlx eas-cli secret:create --scope project --name <NAME> --value <VALUE>`. Used by the `preview-simulator` build profile in `eas.json` (Task 32b iOS Simulator Sentry app smoke).

| Variable                          | Required? | Source                                                                         |
| --------------------------------- | --------- | ------------------------------------------------------------------------------ |
| `EXPO_PUBLIC_SUPABASE_URL`        | Yes       | Supabase project URL                                                           |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY`   | Yes       | Supabase anon key (publishable in client bundles)                              |
| `EXPO_PUBLIC_NAVER_MAP_CLIENT_ID` | Yes       | ncloud Naver Maps client ID (Phase 1 setup)                                    |
| `EXPO_PUBLIC_API_URL`             | Yes       | Render service URL (e.g. `https://ironspot.onrender.com`)                      |
| `EXPO_PUBLIC_SENTRY_DSN`          | No        | Sentry `ironspot-app` project DSN. Empty value skips Sentry init (fail-open).  |
| `SENTRY_AUTH_TOKEN`               | Yes\*     | Sentry auth token (`project:releases` scope). \*Required for sourcemap upload. |

`eas.json` itself only bakes the non-secret `EXPO_PUBLIC_SENTRY_SMOKE=true` into the preview-simulator profile so the smoke button gates correctly.

## Post-deploy smoke procedures (Task 32 timing)

### Sentry app

Per Task 32 decision #4, the app-side verification uses an iOS Simulator preview build via EAS rather than TestFlight or APK. This satisfies the sourcemap-symbolicated-stack intent without requiring an Apple Developer enrolment or a physical device.

1. Ensure `eas.json` has a preview profile with `"simulator": true` for iOS. Run `eas build --platform ios --profile preview --simulator`. Download the resulting `.app` archive.
2. Open iOS Simulator (the same one `pnpm snap` already targets) and drag the `.app` onto the simulator window to install.
3. The smoke button lives in `src/features/profile/components/SentrySmokeButton.tsx`. It renders only when both `__DEV__ === false` AND `process.env.EXPO_PUBLIC_SENTRY_SMOKE === 'true'`. The onPress emits `new Error("ironspot sentry smoke " + Date.now())` through `captureError` (the same path the global error handler uses for unhandled exceptions). The button appears at the bottom of the Profile tab regardless of auth state.
4. The `preview-simulator` profile in `eas.json` bakes `EXPO_PUBLIC_SENTRY_SMOKE=true` into the bundle. After building with that profile and installing the `.app`, open the Profile tab, tap the "Sentry smoke test (ops only)" control. Sentry dashboard, `ironspot-app` project: confirm the event appears with a symbolicated stack (sourcemap upload working) and `environment: production`.
5. Rebuild without the flag for any subsequent verify or release build. Leaving the button code in the bundle is fine; it just never renders.

Deferred to pre-App-Store-submission: native-side crash reproducibility (Objective-C / Swift signals, JVM `NoSuchMethodError`) which cannot be reliably triggered in iOS Simulator. Run one physical-device pass before App Store submission.

### Sentry server

Per Task 32 decision #3, server-side verification uses a permanent gated smoke endpoint (`POST /api/_admin/sentry-smoke`) that mirrors the Slack smoke pattern. Avoid the older "add a `/api/_admin/throw` then revert" or "unset `DATABASE_URL`" approaches: the first risks leaving the throw endpoint behind on prod, the second causes real 5xx traffic to users.

1. In the Render dashboard for `ironspot-api`: **Environment** tab → set `IRONSPOT_SENTRY_SMOKE_ENABLED=true` → **Save Changes**. Render auto-redeploys on env change; wait until the deploy is **Live** and `/actuator/health` returns UP. The 15-min idle sleep does not apply during an active deploy, but if the service was asleep before the change, allow ~60s for cold start.
2. Obtain a valid JWT (Supabase Auth, any authenticated user works).
3. Run one curl:

   ```bash
   API=https://ironspot.onrender.com
   AUTH="Authorization: Bearer $JWT"
   curl -X POST -H "$AUTH" "$API/api/_admin/sentry-smoke"
   ```

4. Confirm the event appears in the Sentry `ironspot-api` project with `environment: production` and a readable stack pointing at `SentrySmokeController`.
5. Render dashboard: set `IRONSPOT_SENTRY_SMOKE_ENABLED=false` → Save Changes → wait for redeploy. Verify a subsequent curl returns `404` (controller bean unregistered).

If the event does not arrive: check the Render env (`SENTRY_DSN` present), then Sentry quota (project not paused), then `GlobalExceptionHandler` logs in the Render **Logs** tab to confirm the 5xx path ran.

### Slack 3-path smoke (replaces "4 throwaway accounts" approach)

1. In the Render dashboard for `ironspot-api`: **Environment** tab → set `IRONSPOT_SLACK_SMOKE_ENABLED=true` → **Save Changes**. Render auto-redeploys; wait until the deploy is Live.
2. Obtain a valid JWT (Supabase Auth, any authenticated user works).
3. Run three curls:

   ```bash
   API=https://ironspot.onrender.com
   AUTH="Authorization: Bearer $JWT"
   curl -X POST -H "$AUTH" "$API/api/_admin/slack-smoke/urgent"
   curl -X POST -H "$AUTH" "$API/api/_admin/slack-smoke/autoblind"
   curl -X POST -H "$AUTH" "$API/api/_admin/slack-smoke/safesearch"
   ```

4. Confirm 3 messages arrive in `#ironspot-moderation`. Each carries the sentinel photo id ending `aa` so an operator can tell at a glance it is a smoke run, not a real event.
5. Render dashboard: set `IRONSPOT_SLACK_SMOKE_ENABLED=false` → Save Changes → wait for redeploy. Verify a subsequent curl returns `404`.

If a path fails to deliver: check the Render env (`SLACK_ADMIN_WEBHOOK_URL` present and matches Slack's current URL for the channel), then Slack's incoming-webhook config (channel not archived, app not revoked).

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
