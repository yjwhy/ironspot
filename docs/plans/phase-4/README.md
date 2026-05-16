# Phase 4 — Plan

Created at the close of Phase 3 (Task 40) as a skeleton. Detailed task breakdown happens at Phase 4 kickoff via `grill-me` once priorities are confirmed.

## Goal

Build on Phase 3's admin + NL Search foundations to (a) close safety gaps surfaced by real moderation flow, (b) raise search quality + efficiency, and (c) productionise the operator toolchain.

## Scope (carry-over from Phase 3)

Tracked but not designed yet. Order is rough priority, not commitment.

1. **Photo PII detection** — Google Vision `FACE_DETECTION` on upload + mosaic-then-store vs reject + backfill pipeline for existing photos. Required before App Store submission per Korean privacy guidelines.
2. **Reporter trust scoring + auto-ban** — currently Phase 3 auto-bans on `dismissed_count >= 5` (Task 34). Phase 4 adds reputation weighting so a few bad reporters can't escalate a target.
3. **Appeal flow** — Phase 3 ban is final. Phase 4 lets banned users open an appeal that re-routes to admin queue. Needed once auto-ban thresholds are tuned aggressively.
4. **`gym_machine` target_type for reports** — Phase 3 reports target photos only. Letting users report wrong-machine-mapping enables crowd-correcting `gym_machines` rows.
5. **Standalone admin web UI (Next.js)** — Phase 3 admin UI lives in the mobile app (`app/admin/`). A web console scales better for the moderation backlog and works on a laptop.
6. **NL query caching** — LLM bypass for repeat queries. Currently every `/api/search/natural` call burns ~2.5K Groq tokens; cache hot queries by normalised text.
7. **Multi-select FilterPanel filters** — ADR 0020 deferred from Phase 3. Backend already accepts array brand/category filters (Task 38a); just the UI is single-select.
8. **Push notifications** — admin dispositions and ban events. Needs `expo-server-sdk-java` integration with Spring scheduler.
9. **Dark mode** — design tokens already abstracted; needs a theme switch + per-token dark variant.
10. **Analytics (PostHog)** — funnel + retention. Held to post-launch since Phase 3 already has Sentry for error/performance.
11. **Slack 전체 로그 연동** — forward all important application logs/events to a single Slack channel for centralised monitoring. Builds on existing `AdminNotificationService` (Phase 2) which already routes auto-blind, urgent reports, and SafeSearch-suspect events. Open design questions: which log level (ERROR-only vs WARN+ vs structured business events), which transport (Logback Slack appender vs Sentry Slack integration vs custom), and whether to gate by namespace.
12. **Gym owner workflow** — give gym owners scoped permissions to verify/approve photos and edit machine inventory for their gym. `users.role = 'owner'` enum value already exists in prod schema (anticipated in Phase 3 but not designed; see Phase 2 carry-over note 4 below). Distributes moderation load from admin queue and adds a trust signal (owner-verified > anonymous). Reduces the urgency of (2) Reporter trust scoring and (5) Standalone admin web UI by replacing parts of their value proposition. Open design questions (locked during Task grill): (a) how someone becomes an owner (self-claim + business doc, admin-granted, Naver Place ID match, auto-grant on N verified contributions), (b) permission scope (photo approval only / + machine inventory / + first-look on reports), (c) gym-to-owner cardinality (1:1, N:1 chain, 1:N co-owners), (d) moderation flow re-design (owner queue with admin escalation on timeout), (e) UI (extend admin screens with role gate vs separate owner screens), (f) trust signal propagation (owner-verified badge on photos, weighted reports).

## Carry-over from Phase 3 verification (Task 40 deferred)

1. **Voice live verification** — Maestro cannot drive system mic, EAS preview-simulator build feasibility constrained on $0 setup. Manually verified at Task 38 PR #79 merge but no automated regression coverage. Phase 4 either (a) accepts manual smoke on each release tag or (b) builds a test-only voice fixture that bypasses STT.
2. **admin-flow Maestro flow** — login bypass infra missing (OAuth opens system browser, Maestro cannot drive). Phase 3 covers admin via Jest (`AdminGuard`/`AdminQueueScreen`/`AdminPhotoScreen` 10 tests) + backend ITs (22 cases) + live curl. Phase 4 either (a) adds test-only `__DEV__` MMKV session injection or (b) waits for Apple Sign In wiring (Pre-Launch Backlog) which uses an in-app sheet Maestro can drive.
3. **EAS preview-simulator build** — Pre-Launch Backlog item. Once Apple Developer enrollment lands, EAS becomes the canonical preview-build path.
4. **Maestro 2.5.1 `accessibilityLabel` regression** — `upload-flow.yaml` + `login-flow.yaml` use `accessibilityLabel:` selector which the installed Maestro version flags as "Unknown Property". Fix one-line per flow during Phase 4's first Maestro touchpoint.

## Phase 2 carry-over gaps (Task 33 PROGRESS L59-63)

Schema drift between prod Supabase + test schema. Not Phase 3 blockers but worth flagging.

1. **`users.deleted_at` missing in prod** — Phase 2 Task 30 (PR #45) added the column to `init-test-db.sql` and `UserRepository.findById`/`markDeleted` reference it; prod schema doesn't have it. `GET /api/users/me` would fail at runtime against prod. Needs `ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ` one-line hotfix.
2. **`reports.reviewed_at` exists in prod, missing from `init-test-db.sql`** — test-schema drift only. Low priority alignment.
3. **`reports.status` enum vs TEXT divergence** — prod uses Postgres enum, test schema uses TEXT. JOOQ generates String. No immediate impact; fixture tests can't reproduce constraint violations.
4. **`users.role` CHECK divergence** — prod allows `('admin','user','owner')`, test allows `('user','admin')`. Test is stricter; harmless for Task 33/34. Likely Phase 4 gym-owner workflow artefact.

## Pre-Launch Backlog (separate from Phase 4)

App Store submission gates. Tracked in `phase-3/PROGRESS.md` Pre-Launch Backlog section.

- Apple Sign In external wiring (Apple Developer enrollment + Service ID + Supabase provider config)
- Privacy Policy + Terms of Service (Korean copy + hosted URLs)
- UptimeRobot keep-warm 5-minute ping on `/actuator/health`

## Out of scope for Phase 4 (post-launch backlog)

Reserved for after first App Store release.

- Dark mode polish across the full token set
- Analytics (PostHog) — wait for retention question to actually become askable
- Multi-platform push notifications routing
- ML reranking on NL search results

## Transition notes (Phase 3 → 4)

- Phase 3 close PR (Task 40, branch `task/40-phase-3-verification`) updates `docs/harness/operations.md` to reflect:
  - Render service hostname `ironspot.onrender.com` (was `ironspot-api.onrender.com`)
  - `SUPABASE_JWKS_URL` replacing the legacy `SUPABASE_JWT_SECRET` env var entry (Supabase migrated to ECC P-256 JWKS)
  - `GROQ_API_KEY` + `GEMINI_API_KEY` required for NL Search (Task 35 dependencies, not in the original Task 32 env table)
- The `task39_eval_retry_pending` memory entry is cleared by Task 40's `gh workflow run llm-eval.yml -r main` retry, recorded in `phase-3/PROGRESS.md` Task 39 row.
- Backend, frontend, and CI are all on Phase 3 main as of `task/40-...` branch creation; Phase 4 forks from main with no rebase coordination needed against Task 40.

## How to start Phase 4

```
grill-me Phase 4 scope and Task 41 first slice
```

`grill-me` walks through which scope item to tackle first, locks acceptance criteria, then `write-plan` (or manual implementation.md) per-task.
