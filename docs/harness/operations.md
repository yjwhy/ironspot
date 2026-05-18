# Operations Playbook

Runtime concerns that live outside the codebase: external accounts, secrets, post-deploy smoke procedures, rotation cadence. Created during Task 31; extended as new operational surfaces land.

## External accounts (one-time setup)

### Sentry (2 projects)

Per Task 31 decision #5 app and API are tracked separately so dashboards stay readable.

1. Sign in / create Sentry org at https://sentry.io (Generate Zero Platform organisation).
2. Create project `ironspot-app` (platform: React Native) → copy DSN → set `EXPO_PUBLIC_SENTRY_DSN` on the EAS build profile and any local `.env` that needs symbolicated events.
3. Create project `ironspot-api` (platform: Java / Spring Boot) → copy DSN → set `SENTRY_DSN` on the Render service environment (and local `iron-spot-api/.env` if exercising the path locally).
4. Sentry → Organization Tokens → create a token (org tokens only carry `org:ci` which covers source-map upload + release creation) → set `SENTRY_AUTH_TOKEN` on EAS build env (used by `@sentry/expo-upload-sourcemaps`; never bundled into the app).
5. **(Optional, for automated verification)** Sentry → Account → API → Personal Tokens → create a token with `Issue & Event = Read` scope only → set `SENTRY_EVENTS_TOKEN` as a GitHub Actions secret. Used by future verification workflows that need to confirm captured events (Phase 3 Task 40 follow-up: `nl_search_empty_result` and similar breadcrumbs). The legacy `SENTRY_AUTH_TOKEN` does **not** cover `event:read` because organization tokens are scope-limited to `org:ci`.
6. Set environments in both projects: `development`, `production`. Default sample rates per decision #11 are wired in code; adjust in dashboard if quota becomes a concern.

DSN-empty contract: both `src/shared/lib/sentry.ts` (`initSentry`) and `iron-spot-api/src/main/java/com/ironspot/common/monitoring/SentryConfig.java` skip init entirely when DSN is blank, so unset values fail open (no traffic) rather than crashing.

### Slack channels (3 routes, separate audiences)

Slack acts as the operator's inbox for three different signal types. Each channel has a distinct trigger surface so noise stays separated.

| Channel                | Source                                                | What lands here                                                                                                                                                                        |
| ---------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `#ironspot-moderation` | Backend (`AdminNotificationService`) Incoming Webhook | Urgent reports, auto-blind, SafeSearch queue, auto-ban uploader/reporter (Phase 2 wiring). Plus weekly moderation digest every Monday 09:00 KST (Phase 4 E + C `ModerationDigestJob`). |
| `#ironspot-errors`     | Sentry Slack integration (OAuth, alert rule)          | Sentry 5xx new issue + regression, `environment=production` only (Task 43 decision).                                                                                                   |
| `#ironspot-deploy`     | GitHub Actions `deploy-notify.yml` Incoming Webhook   | "Deploy triggered" on push to `main` + ":white_check_mark: succeeded" / ":x: failed" once the Render deploy reaches a terminal state (Render API polled by the same workflow).         |

#### One-time setup

1. **`#ironspot-moderation`** (Phase 2 — already wired)
   1. Channel exists in `iron-spot` workspace.
   2. Incoming Webhook installed; URL set as `SLACK_ADMIN_WEBHOOK_URL` on Render. Empty value = `AdminNotificationService` log-only no-op (fail-open).
2. **`#ironspot-errors`** (Task 43)
   1. Create channel in `iron-spot` workspace.
   2. Sentry → Settings → Integrations → Slack → Add Workspace → Authorize (workspace = `iron-spot`) → Allow.
   3. Sentry → project `ironspot-api` → Alerts → Create Alert Rule → "Issue Alert".
      - When: `A new issue is created` OR `An issue changes state from resolved to unresolved`.
      - If: `event.environment` `equals` `production`.
      - Then: Send a notification to Slack workspace `iron-spot`, channel `#ironspot-errors`.
   4. Repeat for project `ironspot-app` with the same channel target.
3. **`#ironspot-deploy`** (Task 43)
   1. Create channel in `iron-spot` workspace.
   2. Install Incoming Webhooks app (`https://iron-spot.slack.com/services/new/incoming-webhook`) → pick channel → copy URL.
   3. GitHub → repo Settings → Secrets and variables → Actions → New secret `SLACK_DEPLOY_WEBHOOK_URL` with the URL above. `.github/workflows/deploy-notify.yml` reads this on every push to `main` and posts `Deploy triggered — <repo> <sha> by <actor>` plus the commit message + link.
   4. **(Outcome polling)** Render Dashboard → Account Settings → API Keys → Create API key → copy. GitHub → Settings → Secrets → Actions → New secret `RENDER_API_KEY`. Once set, `deploy-notify.yml` polls `https://api.render.com/v1/services/<RENDER_SERVICE_ID>/deploys` for the deploy whose `commit.id` matches the pushed SHA, and posts ":white_check_mark: succeeded" / ":x: failed (<render_status>)" / ":hourglass: status check timed out (15m)" / ":grey_question: not matched". When `RENDER_API_KEY` is empty the outcome step is skipped silently and only the "Deploy triggered" message is posted, matching the legacy behaviour.

#### Deploy outcome polling design

Render free Web Service doesn't push deploy events to any external hook, so the same GitHub Actions workflow that posts "Deploy triggered" also polls the Render API (`GET /v1/services/<service-id>/deploys`) for the deploy whose `commit.id` matches `${{ github.sha }}`. Once that deploy reaches a terminal state (`live`, `build_failed`, `update_failed`, `canceled`, `pre_deploy_failed`, `deactivated`) the workflow posts the outcome with elapsed wall-clock time. The 15-minute timeout covers Render free-tier cold start + build + boot worst-case; if the timeout fires the workflow posts ":hourglass: status check timed out" and the operator can inspect the Render dashboard. Required secret: `RENDER_API_KEY` (see one-time setup table above). If you later move to a paid Render plan the dashboard's native Slack integration replaces both steps and the workflow can be dropped.

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

| Variable                        | Required? | Source                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                  | Yes       | Supabase Postgres (pooler URL, e.g. `jdbc:postgresql://aws-<N>-<region>.pooler.supabase.com:6543/postgres?prepareThreshold=0&sslmode=require`). The cluster prefix `<N>` (0, 1, ...) is project-specific — copy the exact hostname from Supabase Dashboard → Connect → Direct → Transaction pooler. `sslmode=require` is mandatory (pgbouncer rejects plaintext with a misleading "ENOTFOUND tenant/user" error).                                   |
| `DATABASE_USERNAME`             | Yes       | Supabase project Postgres credentials (`postgres.<ref>`)                                                                                                                                                                                                                                                                                                                                                                                            |
| `DATABASE_PASSWORD`             | Yes       | Supabase project Postgres credentials                                                                                                                                                                                                                                                                                                                                                                                                               |
| `SUPABASE_JWKS_URL`             | Yes       | `https://<project>.supabase.co/auth/v1/.well-known/jwks.json` — Supabase migrated from HS256 shared secret to ECC P-256 (ES256) signed by per-project keys. `NimbusJwtDecoder` fetches and caches the JWKS in-process.                                                                                                                                                                                                                              |
| `SUPABASE_URL`                  | Yes       | Supabase project URL                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `SUPABASE_SERVICE_ROLE_KEY`     | Yes       | Supabase service role (keep server-only)                                                                                                                                                                                                                                                                                                                                                                                                            |
| `GOOGLE_VISION_API_KEY`         | Yes       | GCP project, Vision API key                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `NAVER_SEARCH_CLIENT_ID`        | Yes       | developers.naver.com 지역검색 앱                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `NAVER_SEARCH_CLIENT_SECRET`    | Yes       | developers.naver.com 지역검색 앱                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `GROQ_API_KEY`                  | Yes       | console.groq.com API key (`gsk_...`). Phase 3 NL Search primary LLM. Empty value short-circuits `GroqLlamaClient` to `LlmException(TRANSPORT)` so `FallbackLlmClient` can hand off to Gemini.                                                                                                                                                                                                                                                       |
| `NTS_BUSINESS_API_KEY`          | No        | 국세청 사업자등록정보 진위확인 API key from data.go.kr (free tier, no per-call billing). Used by `BusinessRegistryClient` in the Task 47 owner-claim flow to verify the 4-tuple (b_no / start_dt / p_nm / b_nm) against the 국세청 record. Empty value falls through to "no verification available" → verifier returns Disputed → admin manual review (gym owner claim still works, just without the auto-grant path).                              |
| `GEMINI_API_KEY`                | Yes       | aistudio.google.com API key (`AIza...`). Phase 3 NL Search fallback LLM via `gemini-flash-lite-latest`.                                                                                                                                                                                                                                                                                                                                             |
| `SENTRY_DSN`                    | No        | Sentry, ironspot-api project, Client Keys                                                                                                                                                                                                                                                                                                                                                                                                           |
| `SLACK_ADMIN_WEBHOOK_URL`       | No        | Slack incoming webhook for #ironspot-moderation                                                                                                                                                                                                                                                                                                                                                                                                     |
| `IRONSPOT_SLACK_SMOKE_ENABLED`  | No        | `false` permanently. Toggle to `true` only during smoke.                                                                                                                                                                                                                                                                                                                                                                                            |
| `IRONSPOT_SENTRY_SMOKE_ENABLED` | No        | `false` permanently. Toggle to `true` only during the Task 32b Sentry server verify, then back to `false`.                                                                                                                                                                                                                                                                                                                                          |
| `SPRING_PROFILES_ACTIVE`        | Yes       | `prod`                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `DASHBOARD_PASSWORD`            | Yes       | HTTP Basic Auth password for the ops dashboard at `https://ironspot.onrender.com/admin/dashboard.html`. Single operator, shared password. Maps to Spring property `dashboard.password` via Spring Boot's default env binding. **Empty value fails startup by design** so the dashboard cannot accidentally land unauthenticated. Rotate by changing the env var and redeploying. Username is hard-coded to `admin`. Phase 4 Operational item E + C. |

DB choice rationale (Task 32 decision #2): Spring Boot uses the Supabase Postgres directly via the pgbouncer transaction-mode pooler rather than a managed Postgres on the hosting platform. This keeps Supabase as the single source of truth for migrations and removes a schema export/import step. The `?prepareThreshold=0` query parameter on `DATABASE_URL` disables JDBC server-side prepared statements, required for compatibility with PgBouncer's transaction pooling. The `&sslmode=require` query parameter forces TLS for the connection; without it pgbouncer rejects the handshake and returns a confusing `(ENOTFOUND) tenant/user postgres.<ref> not found` error that looks like a username/tenant mismatch. HikariCP `maximum-pool-size` is set to 5 in `application-prod.yml` to leave heap headroom for the 512MB Render free instance and to stay inside Supabase's free-tier pgbouncer connection limit.

### Keep-warm strategy (Render free 15-min idle sleep)

Render free Web Service spins down after 15 minutes of inactivity. Cold start for Spring Boot 4 on Render's 0.1 vCPU + 512MB tier is 30~90 seconds, which is unacceptable for user-facing requests. External keep-warm ping every 5 minutes prevents the sleep.

Recommended: **UptimeRobot free monitor** (no card, no time limit).

1. https://uptimerobot.com sign up (email only).
2. Add New Monitor → **Monitor Type: HTTP(S)** → URL: `https://ironspot.onrender.com/actuator/health` → Interval: **5 minutes** → Save.
3. Bonus: configure email alerts on the monitor for downtime visibility.

Fallback if UptimeRobot ever degrades: `.github/workflows/keep-warm.yml` runs `curl --max-time 30 https://ironspot.onrender.com/actuator/health` every 10 minutes. GitHub Actions cron can be skipped under high platform load, so it's a backup rather than the primary mechanism.

## Ops dashboard (`/admin/dashboard.html`)

Phase 4 Operational item E + C (Phase 5 H1/H2 measurement consumption surface). Spring Boot static HTML at `src/main/resources/static/admin/dashboard.html` served behind a dedicated Spring Security chain (`DashboardSecurityConfig`) with HTTP Basic Auth.

**URL**: `https://ironspot.onrender.com/admin/dashboard.html`

**Credentials**:

- Username: `admin` (hardcoded)
- Password: value of `DASHBOARD_PASSWORD` env var (see env table above)
- Browser will prompt once and save to password manager. Subsequent visits are zero-action.

**What you see**:

- **NL Search**: total queries / distinct normalised / distinct users, plus top 20 normalised queries with hit counts. Data from `nl_search_log` (Phase 4 Operational item D).
- **Moderation**: total dispositions, ban event count, uploader actioned histogram (buckets aligning with 3-actioned auto-ban threshold), reporter dismissed histogram (5-dismissed threshold), top 20 reporters with accuracy ratio. Data aggregated over `reports` + `machine_photos` + `users`.
- **Ban events**: chronological list within the period (`all` returns the full ban audit log).

Period selector: 7d / 30d / all. Refresh button reloads. No auto-polling.

**Slack weekly digest**: Monday 09:00 KST → `#ironspot-moderation` (`ModerationDigestJob`). Posts a Korean text summary covering the past 7 days. The dashboard is the deep-dive surface; Slack is the "operator should glance at this" cadence.

**Phase 5 successor**: item 6 in `docs/plans/phase-5/README.md` (Standalone admin web UI, Next.js). Promote once moderation queue volume justifies a proper SPA.

## EAS build secrets (preview-simulator profile)

Set on the EAS project via `pnpm dlx eas-cli secret:create --scope project --name <NAME> --value <VALUE>`. Used by the `preview-simulator` build profile in `eas.json` (Task 32b iOS Simulator Sentry app smoke).

| Variable                          | Required? | Source                                                                                                                 |
| --------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`        | Yes       | Supabase project URL                                                                                                   |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY`   | Yes       | Supabase anon key (publishable in client bundles)                                                                      |
| `EXPO_PUBLIC_NAVER_MAP_CLIENT_ID` | Yes       | ncloud Naver Maps client ID (Phase 1 setup)                                                                            |
| `EXPO_PUBLIC_API_URL`             | Yes       | Render service URL (e.g. `https://ironspot.onrender.com`)                                                              |
| `EXPO_PUBLIC_SENTRY_DSN`          | No        | Sentry `ironspot-app` project DSN. Empty value skips Sentry init (fail-open).                                          |
| `SENTRY_AUTH_TOKEN`               | Yes\*     | Sentry **organization** token (`org:ci` scope: source-map upload + release creation). \*Required for sourcemap upload. |

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

## LLM eval workflow (Groq free-tier budgeting)

`.github/workflows/llm-eval.yml` runs `EvalSuiteTest` against the real Groq API on PRs that touch the LLM stack (`prompts/`, `search/llm/**`, `search/dsl/**`, `SqlBuilder.java`, `DslValidator.java`, `search/eval/**`, `resources/eval/**`) and on manual `workflow_dispatch`.

- **Suite size:** 6 product-value cases (Task 41 trim from 30). Each case ≈ 2.5K tokens, run total ≈ 15K tokens.
- **Free-tier limits (Llama 3.3 70B):** RPM 30, TPM 12K, RPD 1000, TPD 100K. The 15K/run footprint stays at 15% of daily TPD, allowing up to 6 runs/day before hitting the daily bucket.
- **Hidden ceiling:** TPD is not exposed in success-response headers (only in 429 bodies). Inspect with one trivial completion + `grep x-ratelimit /tmp/headers.txt` — `remaining-requests` and `remaining-tokens` (TPM) are visible; daily token bucket is implicit.
- **Per-push trigger gotcha:** GitHub Actions' `pull_request: paths` filter evaluates against the PR's overall diff vs base, not just the latest push. So every push to a PR that already touches eval paths re-fires the workflow, including docs-only follow-up commits. To save tokens on a docs-only push, `gh run cancel <run-id>` within the first ~75 seconds (before the Gradle daemon hits the LLM calls) saves the run cost.

To restore the original 30-case suite for a one-time deep audit:

1. `git show 8fb57cc:iron-spot-api/src/test/resources/eval/queries.yaml > iron-spot-api/src/test/resources/eval/queries.yaml` on a throwaway branch.
2. Trigger before any other Groq activity that day (snapshot recording, parallel PRs). A full run consumes 75% of daily TPD.
3. Discard the branch after the audit; do not merge.

## Google Cloud Vision API budgeting (after Task 42)

`OcrService.analyzeImage` calls the Vision API with 3 features per request: `TEXT_DETECTION` (OCR), `SAFE_SEARCH_DETECTION`, and `FACE_DETECTION` (Task 42 PII gate). Each feature counts as one billable unit.

- **Free tier:** 1000 feature requests/month. 3 features/photo means ~333 uploads/month free.
- **Beyond free tier:** Vision pricing $1.50 per 1000 features. 1000 uploads/month = 3000 features = $3/month.
- **No billing configured:** if free tier exhausts and billing is not set up, Vision API returns errors; `OcrService` already fails open (returns `VisionAnalysisResult.EMPTY` with `verdict=ALLOW`, `hasPii=false`) so uploads continue without PII / OCR / SafeSearch coverage. The fail-open is intentional — better to ship a possibly-uncovered upload than to block all uploads on API quota.

## Known caveats

- Jest emits `A worker process has failed to exit gracefully` after the suite when `@sentry/react-native` was loaded (Sentry's internal timer/native bridge). Exit code is still 0; this is benign and can be ignored unless CI starts failing.
- Sentry app source maps require `pnpm expo prebuild` and the Sentry Expo plugin (registered in `app.json`) to be present in the bundle. Re-run prebuild any time `app.json` plugins change.
- `@sentry/react-native@8.9.2` is pinned exact (no caret) because 8.10+ has an iOS `AVAssetDownloadURLSession` crash (`getsentry/sentry-react-native#7886`). Re-evaluate the pin every quarter; bump only after upstream confirms a fix.
