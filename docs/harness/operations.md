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

| Variable                        | Required? | Source                                                                                                                    |
| ------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                  | Yes       | Supabase Postgres (pooler URL, e.g. `postgresql://postgres.<ref>:<pwd>@aws-0-<region>.pooler.supabase.com:6543/postgres`) |
| `DATABASE_USERNAME`             | Yes       | Supabase project Postgres credentials                                                                                     |
| `DATABASE_PASSWORD`             | Yes       | Supabase project Postgres credentials                                                                                     |
| `SUPABASE_JWT_SECRET`           | Yes       | Supabase dashboard, Auth, JWT Settings                                                                                    |
| `SUPABASE_URL`                  | Yes       | Supabase project URL                                                                                                      |
| `SUPABASE_SERVICE_ROLE_KEY`     | Yes       | Supabase service role (keep server-only)                                                                                  |
| `GOOGLE_VISION_API_KEY`         | Yes       | GCP project, Vision API key                                                                                               |
| `NAVER_SEARCH_CLIENT_ID`        | Yes       | developers.naver.com 지역검색 앱                                                                                          |
| `NAVER_SEARCH_CLIENT_SECRET`    | Yes       | developers.naver.com 지역검색 앱                                                                                          |
| `SENTRY_DSN`                    | No        | Sentry, ironspot-api project, Client Keys                                                                                 |
| `SLACK_ADMIN_WEBHOOK_URL`       | No        | Slack incoming webhook for #ironspot-moderation                                                                           |
| `IRONSPOT_SLACK_SMOKE_ENABLED`  | No        | `false` permanently. Toggle to `true` only during smoke.                                                                  |
| `IRONSPOT_SENTRY_SMOKE_ENABLED` | No        | `false` permanently. Toggle to `true` only during the Task 32b Sentry server verify, then back to `false`.                |
| `SPRING_PROFILES_ACTIVE`        | Yes       | `prod`                                                                                                                    |

DB choice rationale (Task 32 decision #2): Spring Boot uses the Supabase Postgres directly via the pooler URL rather than a separate Railway Postgres. This avoids a schema export/import step and keeps Supabase as the single source of truth for migrations. Set HikariCP `maximum-pool-size` conservatively in `application-prod.yml` to stay inside Supabase pooler limits.

## Post-deploy smoke procedures (Task 32 timing)

### Sentry app

Per Task 32 decision #4, the app-side verification uses an iOS Simulator preview build via EAS rather than TestFlight or APK. This satisfies the sourcemap-symbolicated-stack intent without requiring an Apple Developer enrolment or a physical device.

1. Ensure `eas.json` has a preview profile with `"simulator": true` for iOS. Run `eas build --platform ios --profile preview --simulator`. Download the resulting `.app` archive.
2. Open iOS Simulator (the same one `pnpm snap` already targets) and drag the `.app` onto the simulator window to install.
3. Add a "throw test" button gated by an env flag so it cannot ship by accident: render it only when `__DEV__` is false AND `process.env.EXPO_PUBLIC_SENTRY_SMOKE === 'true'`. The button's onPress calls `throw new Error("ironspot sentry smoke " + Date.now())`. Mirrors the server `IRONSPOT_SLACK_SMOKE_ENABLED` toggle pattern.
4. Build with `EXPO_PUBLIC_SENTRY_SMOKE=true`, reinstall, press once. Sentry dashboard, `ironspot-app` project: confirm the event appears with a symbolicated stack (sourcemap upload working) and `environment: production`.
5. Rebuild without the flag for any subsequent verify or release build. Leaving the button code in the bundle is fine; it just never renders.

Deferred to pre-App-Store-submission: native-side crash reproducibility (Objective-C / Swift signals, JVM `NoSuchMethodError`) which cannot be reliably triggered in iOS Simulator. Run one physical-device pass before App Store submission.

### Sentry server

Per Task 32 decision #3, server-side verification uses a permanent gated smoke endpoint (`POST /api/_admin/sentry-smoke`) that mirrors the Slack smoke pattern. Avoid the older "add a `/api/_admin/throw` then revert" or "unset `DATABASE_URL`" approaches: the first risks leaving the throw endpoint behind on prod, the second causes real 5xx traffic to users.

1. On Railway: set `IRONSPOT_SENTRY_SMOKE_ENABLED=true`, trigger a redeploy, wait until the health check is green.
2. Obtain a valid JWT (Supabase Auth, any authenticated user works).
3. Run one curl:

   ```bash
   API=https://your-railway-url
   AUTH="Authorization: Bearer $JWT"
   curl -X POST -H "$AUTH" "$API/api/_admin/sentry-smoke"
   ```

4. Confirm the event appears in the Sentry `ironspot-api` project with `environment: production` and a readable stack pointing at `SentrySmokeController`.
5. On Railway: set `IRONSPOT_SENTRY_SMOKE_ENABLED=false`, trigger a redeploy. Verify a subsequent curl returns `404` (controller bean unregistered).

If the event does not arrive: check Railway env (`SENTRY_DSN` present), then Sentry quota (project not paused), then `GlobalExceptionHandler` logs to confirm the 5xx path ran.

### Slack 3-path smoke (replaces "4 throwaway accounts" approach)

1. On Railway: set `IRONSPOT_SLACK_SMOKE_ENABLED=true`, trigger redeploy, wait until health check is green.
2. Obtain a valid JWT (Supabase Auth, any authenticated user works).
3. Run three curls:

   ```bash
   API=https://your-railway-url
   AUTH="Authorization: Bearer $JWT"
   curl -X POST -H "$AUTH" "$API/api/_admin/slack-smoke/urgent"
   curl -X POST -H "$AUTH" "$API/api/_admin/slack-smoke/autoblind"
   curl -X POST -H "$AUTH" "$API/api/_admin/slack-smoke/safesearch"
   ```

4. Confirm 3 messages arrive in `#ironspot-moderation`. Each carries the sentinel photo id ending `aa` so an operator can tell at a glance it is a smoke run, not a real event.
5. On Railway: set `IRONSPOT_SLACK_SMOKE_ENABLED=false`, trigger redeploy. Verify a subsequent curl returns `404`.

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
