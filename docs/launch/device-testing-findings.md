# Device Testing Findings

Real-device test log captured while running Phase 4 main HEAD on a physical iPhone 14 Pro (free Apple Developer account + Local Xcode build path, see `docs/launch/pre-submission-checklist.md` Section 11 for the procedure).

Each finding has a severity, a status, and a fix plan. Update entries as they get triaged or shipped. Pre-submission checklist Section 10 (smoke checklist) should re-run after blockers close.

## Severity

- 🔴 **Blocker**: must fix before App Store submission.
- 🟡 **Should-fix**: not a submission blocker but degrades launch-day UX.
- 🟢 **Polish**: nice-to-have, post-launch acceptable.

## Status

- `open`: not started
- `triaged`: cause confirmed, fix plan locked
- `in-progress`: PR in flight
- `fixed`: merged
- `wont-fix`: deliberately deferred (link the rationale)

---

## F1 — Search error toast when not authenticated is unfriendly 🟡 open

**Discovered**: 2026-05-19 device test, iPhone 14 Pro (iOS 26.3.1), prod backend (https://ironspot.onrender.com)

**Symptom**: searching "강남역 근처 헬스장" in NL search bar while logged out (Guest mode) produces a generic error toast. No mention that authentication is required, no signup CTA.

**Cause** (suspected, pending confirmation): `/api/search/natural` requires authentication per Task 37 SecurityConfig (`.requestMatchers("/api/search/natural").authenticated()`). Anonymous calls return 401. Frontend treats 401 the same as any other failure and shows the generic search-error toast.

**Fix plan**:

- Frontend: detect 401 specifically in NL search call path → show a dedicated dialog/sheet with "로그인이 필요해요. 자연어 검색을 사용하려면 회원가입 후 다시 시도하세요." + CTA button that routes to LoginScreen.
- Same pattern applies to other auth-gated features (upload, report, my-page) — generalise via a shared `Unauthorized` handler in the api-client mutator.
- Backend: no change.

**Affected files**: `src/shared/lib/api-client.ts` (mutator), NL search hook (`src/features/search/...`), LoginScreen navigation hook.

**Risk**: low. Pure frontend, no schema or backend change.

---

## F2 — `reports.owner_timeout_at` column missing in prod schema 🔴 fixed

**Discovered**: 2026-05-19 device test, Render Logs tab — `OwnerTimeoutEscalationJob` failing on every scheduled run with:

```
Caused by: org.postgresql.util.PSQLException:
  ERROR: column reports.owner_timeout_at does not exist
  Position: 136
```

Stack trace originates from `com.ironspot.photo.ReportRepository.clearOwnerTimeoutsBefore` → `OwnerTimeoutEscalationJob.escalate` (Task 47 Phase 4 work, owner queue 24-hour timeout cron).

**Cause**: Task 47 added a Flyway migration (V2 owner workflow) and modified `ReportRepository` to query `reports.owner_timeout_at`. The migration is in `iron-spot-api/src/main/resources/db/migration/V2__task47_gym_owner.sql` and `init-test-db.sql` mirrors it. **Prod Supabase did not have V2 applied**, or applied a partial version that missed the `reports.owner_timeout_at` column. Render Flyway runs on startup, so either:

- Flyway found V2 already marked applied (manual MCP intervention before Flyway adoption?) and skipped → schema is partially drifted.
- Or the column is in a separate migration that wasn't picked up.

Need to verify by inspecting `flyway_schema_history` table on Supabase + the actual `reports` table columns.

**Fix plan**:

1. Inspect Supabase via dashboard SQL editor: `SELECT * FROM flyway_schema_history` plus `\d reports`.
2. If V2 missing entirely → re-run Flyway (Render redeploy should idempotently apply via `IF NOT EXISTS` etc.).
3. If V2 partially applied → write a V5 corrective migration: `ALTER TABLE reports ADD COLUMN IF NOT EXISTS owner_timeout_at TIMESTAMPTZ;`. Hand-mirror to `init-test-db.sql` (already has it per Task 47 PROGRESS, verify), JOOQ regen if needed.
4. Verify by tail-following Render logs after redeploy — `OwnerTimeoutEscalationJob` should stop spamming the SQL error.

**Risk**: medium. Production data is small enough that ALTER TABLE is safe, but the symptom suggests a longer schema-drift trail that should be audited holistically (Phase 2 carry-over Task notes already document a similar `users.deleted_at` situation that turned out to be resolved silently).

**Related**: see [`docs/plans/phase-3/PROGRESS.md`](../plans/phase-3/PROGRESS.md) Phase 2 carry-over section for the precedent.

---

## F4 — `gym_machines.deleted_at` column missing in prod schema 🔴 fixed

**Discovered**: 2026-05-19 device test, iOS simulator (iPhone 16 Plus, iOS 18.6) + Render Logs.

**Symptom**: NL search ("강남역 근처 헬스장") returns 0 results in the app UI, displayed as "조건에 맞는 헬스장이 없어요". Underneath, Render log shows the actual cause:

```
Caused by: org.postgresql.util.PSQLException:
  ERROR: column gm.deleted_at does not exist
  Position: 557
```

NL search SQL builder (and the general gym search hot path via `GymRepository`) filters with `WHERE gm.deleted_at IS NULL` — fails with SQL exception at every call. The pipeline likely catches the JOOQ exception and returns an empty result list to the controller, so the UI sees "0 gyms" rather than a 5xx.

**Cause**: Identical class of drift to F2. V1 baseline (`V1__baseline.sql:98`) defines `gym_machines.deleted_at` and V2 (`V2__task47_gym_owner.sql:90`) re-asserts `ALTER TABLE ... ADD COLUMN IF NOT EXISTS deleted_at`. Both should be idempotent and should have created the column on prod. Either:

- Prod schema predates Flyway and was hand-created without `deleted_at` → Flyway recorded V1/V2 as applied because the table existed, but the migration body's CREATE TABLE IF NOT EXISTS no-oped and the column was never added.
- Or the `ADD COLUMN IF NOT EXISTS` in V2 ran in a Postgres version that didn't support that syntax in DDL (unlikely with Supabase Postgres 15+).

**Fix plan**:

1. Apply ALTER directly via Supabase SQL Editor (bundle both F2 and F4):

   ```sql
   ALTER TABLE gym_machines ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
   ALTER TABLE reports ADD COLUMN IF NOT EXISTS owner_timeout_at TIMESTAMPTZ;
   ```

2. Verify columns exist via `\d gym_machines` and `\d reports` (or `SELECT column_name FROM information_schema.columns WHERE table_name = 'gym_machines'`).

3. Author V5 corrective migration in repo for future-proofing (so a fresh deploy or local replay carries the same fix):

   ```sql
   -- V5__schema_drift_corrective.sql
   ALTER TABLE gym_machines ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
   ALTER TABLE reports ADD COLUMN IF NOT EXISTS owner_timeout_at TIMESTAMPTZ;
   ```

4. After ALTER applied, trigger NL search again in simulator → confirm gyms return (or, if data is genuinely empty, the 0-result message stays but Render log stops emitting SQL exceptions).

5. **Systematic audit**: this is the second prod-drift hit in one device-test session (`reports.owner_timeout_at` + `gym_machines.deleted_at`). Run a full schema diff between `init-test-db.sql` and `\d <table>` for every table to catch the rest before launch. Document in a follow-up doc (`docs/harness/prod-schema-audit-2026-05-19.md`).

**Risk**: low. ADD COLUMN with default NULL is non-blocking + non-rewriting in modern Postgres.

**Blocker for**: NL search + all gym list endpoints. App is effectively unusable until fixed.

---

## F3 — `OwnerTimeoutEscalationJob` exception is silent to operators 🟡 open

**Discovered**: Same Render Logs session as F2.

**Symptom**: the SQL exception in F2 is happening on every scheduled run (suspected hourly or per-minute, depending on cron). It appears only in Render Logs — not Sentry, not Slack `#ironspot-errors`. Operators wouldn't notice without an unrelated reason to open Render Logs.

**Cause**: `OwnerTimeoutEscalationJob` likely catches/logs without re-raising to Sentry, or the scheduled job's exception handling doesn't trigger `@ExceptionHandler` paths.

**Fix plan**:

- Audit `OwnerTimeoutEscalationJob` exception handling — should call `Sentry.captureException(e)` on failure so operators see it via the existing `#ironspot-errors` Slack alert rule.
- Same audit for `NlSearchLogRetentionJob` and `NlSearchQuotaResetJob` and `ModerationDigestJob` — every `@Scheduled` task should surface failures to Sentry.

**Affected files**: `iron-spot-api/src/main/java/com/ironspot/owner/OwnerTimeoutEscalationJob.java` (verify capture), plus the three @Scheduled jobs above.

**Risk**: low. Pure observability improvement, no semantic change.

**Blocks F2 discovery cadence**: without this, future similar drift would also stay invisible.

---

## Resolution log

### 2026-05-19 schema drift remediation

Manual ALTER + table CREATE statements applied via psql against prod
Supabase to restore V2/V3/V4 objects (`gym_machines.deleted_at`,
`reports.owner_timeout_at`, `machine_photos.verified_by_owner_at`,
`gym_owners`, `moderation_audit_log`, `nl_search_log`,
`nl_search_analytics_30d`, `moderation_analytics_30d`). Statements are
codified in `V5__corrective_schema_drift.sql` so the fix lands in the
next Flyway baseline.

Root cause: Flyway was wired in Task 47 with `baseline-on-migrate=true,
baseline-version=1` but `flyway_schema_history` did not exist in prod —
Flyway never ran on Render. Open question: why didn't Flyway run? On
the next deploy with V5 present, Flyway should baseline V1, see
V2/V3/V4/V5 not in history, run them (all idempotent now), and stamp
the history. If that doesn't happen, the wiring needs further audit
(potentially missing `flyway-database-postgresql` dependency or a
classpath issue).

Post-fix verification:

- `psql` schema audit: every expected column/table/view present.
- `GET /api/gyms/search`: 200 OK with 2 gyms in prod (피트니스 팩토리,
  스트렝스 짐).
- iOS Simulator NL search "강남역 파나타": 200 OK, AI interpretation
  rendered, 2 gym cards displayed with distance + machine count, map
  markers placed.

F2 + F4 closed by this remediation. F1 (UX) + F3 (silent failure)
still open.

## Open questions

- Why did Flyway never run on prod even though `enabled: true`? Possible
  causes: classpath ordering, Render JDBC driver detection, or a startup
  exception swallowed pre-Flyway. Address before relying on Flyway for
  future migrations.

## Related documents

- `docs/launch/pre-submission-checklist.md` — section 10 smoke checklist re-runs after fixes
- `docs/harness/operations.md` — Ops dashboard for ongoing log inspection
- `docs/plans/phase-4/PROGRESS.md` — operational items, this finding list is downstream
