# Phase 4 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Phase:** 4 (Eval health + photo PII + post-Phase 3 hardening)
**Version:** 1.0
**Date:** 2026-05-16
**Author:** YJ (builtByYJ)

## Goal

Phase 4 starts by repairing the one Phase 3 verification artefact that surfaced as broken (the LLM eval workflow) and then proceeds through the App Store gating items + feature backlog catalogued in `phase-4/README.md`. The first Task is small by design to warm into Phase 4 cadence before the larger photo-PII Task.

## Scope rationale (Task 41 placement)

`phase-4/README.md` defers Task 41 selection to a `grill-me` session. The grill confirmed:

- **No external launch deadline** — solid app implementation is prioritised over App Store gate items.
- **Eval workflow is broken on `main`** — `gh workflow run llm-eval.yml -r main -f model=groq` (run 25950954965, Task 40 retry) failed 16/16 attempted cases. Root cause analysis in `phase-3/PROGRESS.md` Task 40 row mis-attributed this to Groq output drift via `SemanticMatcher`; the actual failure is `LlmException` at `EvalSuiteTest.java:87` (the LLM-call catch path), not the matcher assertion at line 98.
- **Structural cost issue** — 30 cases × ~2.5K tokens ≈ 75K per run = **75% of Groq free-tier TPD (100K/day)**. Any same-day Groq activity (snapshot recording, dev iteration, parallel PR) tips the run into RATE_LIMIT mid-suite. The fix is not "throttle harder" or "rerun on fresh day" — it is structural budget reduction.

## Task 41 — Trim eval suite to 6 product-value cases

### Why now

Currently `main` carries a fundamentally fragile eval workflow that will fail on any day where other Groq activity precedes it. Without repair, every future LLM-touching PR in Phase 4+ either ships without eval signal or burns the user's TPD budget on a half-functional check. Repair is small (single PR, 2 slices) and unblocks future Tasks.

### Approach

Two-axis change to `iron-spot-api/src/test/resources/eval/queries.yaml`:

1. **Cut from 30 cases to 6.** Each retained case exercises a distinct code path that justifies IronSpot over generic gym search (Naver Maps). Cases that only test location/radius/category extraction were dropped because they do not differentiate the product.
2. **Refresh the inline math comment in `EvalSuiteTest.java`.** The Task 39 comment claimed 15s throttle keeps TPM at 9K/min "comfortably under TPM 12K" — that math is still correct, but it omitted the TPD ceiling. The new comment documents both axes.

### Retained cases (6)

| #   | Input                                                                     | Code path                                                  |
| --- | ------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | `근처 테크노짐 있는 곳`                                                   | brand only + default radius/minCount/scope=EACH            |
| 2   | `근처 하이로우 있는 곳`                                                   | machineName only (FuzzyMatchService template lookup)       |
| 3   | `강남역 파나타 하이로우 있는 헬스장`                                      | brand + machineName same filter (canonical IronSpot query) |
| 4   | `강남역 1km 안 파나타 하이로우 2개랑 해머스트렝스 시티드로우 2개 있는 곳` | multi-filter EACH + explicit radius extraction             |
| 5   | `근처 파나타나 테크노짐 머신 합쳐서 5개 이상 있는 헬스장`                 | COMBINED scope (`HAVING SUM(quantity) >= threshold`)       |
| 6   | `DROP TABLE users; --`                                                    | error response shape + SQL-injection rejection             |

### Dropped categories (24)

- **Cases 1-8** (generic "근처 헬스장" + named-place variants): Naver Maps covers these. No product differentiation.
- **Cases 9-11** (broad category: 가슴/등/다리 머신): too generic to justify the app over a category filter on any gym listing service.
- **Cases 12, 14, 17, 18, 20, 21** (brand/machineName variants of cases 13/16/19): redundant code-path coverage. LLM generalisation is assumed.
- **Cases 23, 24, 26** (other COMBINED/OR variants): case 25 (retained) covers the canonical COMBINED SQL path. The other variants share the same `SqlBuilder` branch.
- **Cases 27, 28** (non-gym query errors): case 29 (retained) covers the most critical error path (SQL injection); 27/28 share the same `LlmException` shape.
- **Case 30** (`헬스장` minimal input): edge case with low product value.

### Token budget

|                           | Before (30 cases)             | After (6 cases) |
| ------------------------- | ----------------------------- | --------------- |
| Per run                   | ~75K tokens                   | ~15K tokens     |
| % of Groq TPD (100K/day)  | 75%                           | 15%             |
| Runs/day under TPD        | 1 (assumes no other activity) | 6               |
| Wallclock at 15s throttle | ~7.5 min                      | ~90s            |

### Slices

| Slice | Files                                                                                                                                                             | Description                                                                                                                                                                                           |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 41a   | `iron-spot-api/src/test/resources/eval/queries.yaml`, `iron-spot-api/src/test/java/com/ironspot/search/eval/EvalSuiteTest.java`, `.github/workflows/llm-eval.yml` | Cut yaml 30 → 6 cases. Update Javadoc + inline throttle comment with new TPM/TPD math. Workflow PR-comment template `/ 30` → `/ 6`.                                                                   |
| 41b   | `docs/plans/phase-4/implementation.md`, `docs/plans/phase-4/PROGRESS.md`, `docs/plans/phase-3/PROGRESS.md`, `docs/harness/operations.md`, memory                  | Phase 4 doc scaffold (this file + PROGRESS.md). Correct Phase 3 PROGRESS.md Task 40 row root cause attribution. Operations note on how to temporarily restore full 30-case eval. Memory file rewrite. |

### Verification

1. `pnpm lint && pnpm exec tsc --noEmit && pnpm jest` — frontend unaffected, must stay green (484/484).
2. `./gradlew test` from `iron-spot-api/` — `EvalSuiteTest` skips by default (`EVAL_RUN` env unset), `SemanticMatcherTest` (20 cases) still validates matcher logic.
3. Push branch + `gh workflow run llm-eval.yml -r task/41-eval-suite-trim -f model=groq` — expect 6/6 PASS, ~90s wallclock, ~15K tokens consumed. Confirms the eval workflow itself is functional now that the case count fits budget.
4. PR title: `Task 41: trim eval suite to 6 product-value cases`.

### Token spend for Task 41 itself

- Diagnostic curl during grill (~10 tokens)
- Verification workflow run (~15K tokens)
- **Total: ~15K**, vs the 75K that a single "just rerun the original" attempt would have cost without the repair.

## Task 42 — Photo PII detection (face rejection on upload)

### Why now

Task 41 closed the eval workflow gap. Task 42 takes the first App Store + Korean privacy law gating item from the README scope. Implementation cost is small (one Vision API feature added to the existing call, one threshold check in `PhotoService`); the alternative scope items either depend on real user data (reporter trust scoring, push notifications, PostHog) or are polish work (dark mode, multi-select FilterPanel UI).

### Approach

Extend the existing `OcrService.analyzeImage` Vision API call with a third feature (`FACE_DETECTION`) alongside the current `TEXT_DETECTION` + `SAFE_SEARCH_DETECTION`. No new network round-trip; Vision returns all three feature annotations in a single response. `PhotoService.upload` checks the new `VisionAnalysisResult.hasPii` flag and rejects with 400 + Korean error message before storage upload (same short-circuit pattern as the existing SafeSearch REJECT path).

### Grilled decisions (locked before code)

1. **Action policy = Reject** (option B from grill). Auto-mosaic (option A) was the recommended path; user chose "일단" Reject to ship the minimum viable PII compliance first, observe rejection rate in production, then upgrade to auto-mosaic in a follow-up Task if rejection rate is too high. Reject avoids needing a server-side image processing library + WebP-capable mosaic algorithm.
2. **Threshold = B3** (confidence 0.7 + 1% area). `detectionConfidence >= 0.7` filters Vision's own low-confidence detections; `face area / image area >= 0.01` lets small background figures through. Both axes required — either alone is too loose or too strict. Korean privacy law's "특정 개인을 식별할 수 있는" standard maps cleanly to the 1% area floor; 5px background faces are not identifiable.
3. **Backfill policy = O4** (delete existing 5 photos before launch). Production has 5 visible photos (`SELECT COUNT(*) FROM machine_photos`), all test data. User will manually delete them before App Store submission. Task 42 ships with no backfill code.
4. **Slack admin notify = no** (for PII rejection). SafeSearch REJECT also doesn't notify admin (the user is the one being told to retake). PII rejection mirrors that to keep admin signal-to-noise aligned.

### Slices

| Slice | Files                                                                                                                                                                                                                           | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 42a   | `iron-spot-api/src/main/java/com/ironspot/photo/PiiDetection.java` (new), `OcrService.java`, `dto/VisionAnalysisResult.java`, `PhotoService.java`, `PiiDetectionTest.java` (new), `OcrServiceTest.java`, `PhotoUploadTest.java` | `PiiDetection.hasPii(faceAnnotations, totalPixels)` pure utility implementing the B3 threshold. `OcrService.analyzeImage` adds `FACE_DETECTION` feature + parses `faceAnnotations` + reads image dimensions via `ImageIO` (header-only, no full decode) + delegates to `PiiDetection.hasPii`. `VisionAnalysisResult` gains a `boolean hasPii` field. `PhotoService.upload` throws `BusinessException(400)` on `hasPii=true` with Korean error message. Tests: PiiDetectionTest +10 (pure unit, threshold + bbox edge cases), OcrServiceTest +2 (no-face response, face + undecodable bytes fail-open), PhotoUploadTest +1 (PII reject integration). |
| 42b   | `docs/plans/phase-4/implementation.md`, `docs/plans/phase-4/PROGRESS.md`, `docs/plans/phase-4/README.md`, `docs/harness/operations.md`                                                                                          | Task 42 entry (this slice). PROGRESS Task 42 checkbox + log row. README scope list +1 (Slack 전체 로그 연동, user-requested candidate). operations.md: Vision API free-tier note (1000 features/month, 50% increase with FACE_DETECTION still under) + Task 41 follow-up note ("pull_request: paths" filter evaluates against the PR overall diff so every push to an eval-touching PR re-triggers the eval workflow).                                                                                                                                                                                                                              |
| chore | `.maestro/flows/upload-flow.yaml`                                                                                                                                                                                               | `accessibilityLabel:` selector property → plain-text `tapOn: 'X'` form. Maestro 2.5.1 reports "Unknown Property: accessibilityLabel"; plain text matches accessibility label as fallback (login-flow.yaml convention).                                                                                                                                                                                                                                                                                                                                                                                                                              |

### Token / cost spend for Task 42

- Vision API: 3 features × test uploads. Tests mock `OcrService` so 0 real API calls during verification. Production impact: existing 2 features/photo → 3 features/photo (50% increase), still under Vision free tier 1000/month assuming <333 uploads/month.
- Groq: 0 (PII is Vision API, no LLM).

### Verification

1. `pnpm lint && pnpm exec tsc --noEmit && pnpm jest` — frontend untouched, must stay green (484/484).
2. `./gradlew test` — backend 282 (Phase 3) + 13 new = 295 tests. EvalSuiteTest still skipped (no `EVAL_RUN`).
3. PR auto-trigger: `llm-eval.yml` does NOT fire (Task 42 diff doesn't match path filter — only touches `photo/`, `dto/`, tests, docs, maestro).

## Task 43 — Slack 라우팅 (Sentry → #ironspot-errors, Render → #ironspot-deploy)

### Why now

Operator monitoring currently relies on Sentry email + a single `#ironspot-moderation` Slack channel that mixes admin moderation events with no error/deploy signal. Email is high-latency and asynchronous; the operator wants Sentry 5xx and Render deploy outcomes to land in Slack alongside the existing moderation events, on separate channels so audiences don't blur. Task 42 PII just shipped to prod, and Render Hobby has no deploy notification surface — these reinforce the need now but neither blocks future work.

### Grilled decisions (locked before code entry)

1. **Scope = operator visibility, not "every log line".** Three signal categories:
   - 5xx exceptions (already in Sentry) → route to Slack instead of email.
   - Render deploy events → separate Slack channel.
   - "Confirmation unnecessary" 4xx (PII rejection, validation failures, quota) → explicitly **excluded** from alerts (current `GlobalExceptionHandler` policy already enforces this by capturing only 5xx).
     Option (a) Logback Slack appender and option (b) "everything via Sentry" were rejected because (a) drowns the channel in Spring/Hibernate WARNs and (b) Sentry's 4xx exclusion is structural, not configurable.
2. **Channel layout = 3 separated channels.** `#ironspot-moderation` (existing, admin events), `#ironspot-errors` (new, Sentry 5xx), `#ironspot-deploy` (new, deploy notify). Two channels (merging errors + deploy) was rejected because deploy notifications and Sentry errors have different cadences and different action expectations.
3. **Sentry alert rule = `environment=production` + new issue OR regression.** Both axes required:
   - "Every 5xx event" floods on persistent bugs.
   - "High frequency only" hides single-event regressions.
     Filtering by `production` blocks dev/local noise (also unlikely because dev DSN is empty per `SentryConfig` fail-open path, but defence-in-depth).
4. **Render notification = GitHub Actions push-notify workflow.** Render Hobby plan does not expose Slack notifications. Three options grilled:
   - Push-notify only (chosen): `on: push: branches: [main]` → Slack post on commit. ~30 LOC. Render dashboard handles success/failure confirmation.
   - Push-notify + post-deploy `/actuator/health` probe (rejected): race condition on cold-start cycles can falsely report success while old container still 200s during build.
   - Render Deploy Hook + REST API polling (rejected): requires structural change (disable Render auto-deploy) for a marginal accuracy gain.
5. **Slack webhook self-failure → no Sentry escalation** for now. Existing `AdminNotificationService.post` logs `log.warn` on Slack delivery failure; option to escalate to `Sentry.captureMessage` was deferred to keep this Task config-only (no Java diff).

### Approach

**No backend code change.** Three out-of-repo configuration steps plus one workflow file:

1. **Slack workspace** — create `#ironspot-errors` + `#ironspot-deploy` channels. Install Incoming Webhook app on `#ironspot-deploy`; capture URL.
2. **GitHub Actions secret** — `SLACK_DEPLOY_WEBHOOK_URL` set to the captured URL.
3. **Sentry integration** — install Sentry's native Slack OAuth integration on the iron-spot workspace; create alert rule per decision #3 above, targeting `#ironspot-errors`. Same rule duplicated for `ironspot-app` project (RN crashes) and `ironspot-api` project (backend 5xx).
4. **`.github/workflows/deploy-notify.yml`** — push-trigger workflow posting deploy-triggered message to `#ironspot-deploy`. Uses `jq` for payload JSON-escape so commit messages with quotes/backslashes/newlines don't corrupt the webhook body. `curl --fail-with-body` so action surfaces real Slack errors.

### Slice breakdown

Single PR, single feature commit + docs commit (Task is below 200 LOC across <10 files threshold for slice splitting).

| Slice | Files                                                                                                  | Content                                                                                                                                                                                                                                                                                      |
| ----- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 43a   | `.github/workflows/deploy-notify.yml`                                                                  | Push-notify workflow. `on: push: branches: [main]` + `workflow_dispatch`. Single job, single step running jq + curl against `SLACK_DEPLOY_WEBHOOK_URL`. `concurrency: deploy-notify-${{ github.ref }}` with `cancel-in-progress: false` so rapid pushes don't drop notifications.            |
| 43b   | `docs/harness/operations.md`, `docs/plans/phase-4/implementation.md`, `docs/plans/phase-4/PROGRESS.md` | operations.md "Slack channels" section rewritten from single-channel into 3-channel table with per-channel setup instructions (Slack workspace + Sentry OAuth + Render-free workaround explanation). implementation.md Task 43 entry (this section). PROGRESS.md Task 43 checkbox + log row. |

### Token / cost spend for Task 43

- Vision API: 0.
- Groq: 0.
- New runtime cost: GitHub Actions runner ~30s per push to `main` (well within free-tier budget).

### Verification

1. `pnpm lint && pnpm exec tsc --noEmit && pnpm jest` — frontend untouched, must stay green (484/484).
2. `./gradlew test` — backend untouched, must stay green (295/295).
3. Manual smoke: trigger `Deploy notify` workflow via `workflow_dispatch` after merge to confirm webhook URL + payload format work end-to-end. (Cannot run on PR branch since `SLACK_DEPLOY_WEBHOOK_URL` is a repository secret not exposed to PRs from forks; this is also the safer default.)

## Future Tasks (planned order, locked via Task 42 grill follow-up)

The remainder of Phase 4 has a recommended order derived from dependency + cost analysis (not the README ordering, which is unsorted scope). Each Task still gets its own `grill-me` + plan entry before implementation; this list is the queue not the design.

### Tier 1 — Immediate value, no dependencies

- **Task 44**: Multi-select FilterPanel UI (ADR 0020) — completes Task 38a backend debt. Backend already accepts array `brandIds`/`categoryIds`; UI is single-select. Small frontend Task, user-visible value.
- **Task 45**: gym_machine report target — extend the report system from photo-only to also cover wrong-machine-mapping. Enables crowd-correcting `gym_machines` rows. Modest backend + admin UI extension. Feeds Tier 2 (owner workflow input) and Tier 4 (reporter trust scoring input) with more data shapes.

### Tier 2 — Substantive moderation + launch gating

- **Task 46**: Gym owner workflow — give gym owners scoped permissions to verify/approve photos and edit machine inventory for their gym. `users.role = 'owner'` already in prod CHECK constraint (Phase 3 prep, no migration). Distributes moderation load from admin queue, adds trust signal (owner-verified > anonymous). Largest Task in this tier (4-6 slices, comparable to Task 33-34). 6 design branches to grill at Task entry (owner verification path, permission scope, gym-to-owner cardinality, moderation flow re-design, UI, trust signal propagation).
- **Task 47**: Apple Sign In external wiring — App Store submission requires Apple Sign In option on iOS. Apple Developer Program enrollment ($99/year) is a user prerequisite. Supabase Apple provider + `ios.usesAppleSignIn` + real-device test. Unlocks the Maestro-driveable in-app sheet that Task 48 depends on.
- **Task 48**: admin-flow Maestro flow — depends on Task 47. Phase 3 verification carry-over (Task 40 deferred); closes the admin testing gap by using Apple Sign In as the Maestro-driveable login path. Small Task (1-2 slices).

### Operational (parallel, not numbered Tasks)

- **UptimeRobot keep-warm** — 5-min cron ping on `/actuator/health` to defeat Render free 15-min idle sleep. ~10 min total work (account + URL). Pre-launch operational.
- **Privacy Policy + Terms of Service** — Korean copy + hosted URLs + App Store Connect link. Content-bottleneck rather than code. Pre-launch legal.
- **EAS preview-simulator build** — depends on Task 47's Apple Developer enrollment side-effect. Once available, becomes the canonical preview-build path for live verification flows.

### Tier 3 — Post-launch data-driven (deferred until users)

After launch, these become decidable with real data:

- Reporter trust scoring + auto-ban tuning — needs real abuse patterns; current `actioned >= 3` / `dismissed >= 5` thresholds are guesses. Task 46 (owner workflow) reduces the urgency by replacing parts of the value proposition.
- Appeal flow — needs auto-ban events to know if thresholds are too aggressive.
- Voice live verification — accept manual smoke on each release tag until either (a) test fixture is built, or (b) EAS preview-simulator path lands.
- Push notifications — needs a user base to notify; admin disposition + ban events as first triggers.
- NL query caching — needs query volume; quota 100/month/user already gates spend so this is premature.
- Standalone admin web UI (Next.js) — needs moderation queue volume to justify duplicating mobile admin work. Task 46 (owner workflow) reduces urgency by distributing load.
- PostHog analytics — needs users; funnel/retention questions become askable.
- Dark mode — polish; tokens already abstracted, needs theme switch + dark variants.

### Phase 5+ (out of Phase 4 scope)

- Multi-platform push routing
- ML reranking on NL search
