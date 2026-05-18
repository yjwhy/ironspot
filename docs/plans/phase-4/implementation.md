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

## Task 44 — FilterPanel scalability + `loadingType` surface (ADR 0021)

### Why now

Phase 4 README scope #7 ("Multi-select FilterPanel filters") 는 Task 38b 가 이미 brand/category multi-select 를 처리했기 때문에 stale 상태였다. grill 결과 Task 44 의 진짜 작업 범위는 다음 세 가지 성숙도 갭으로 재정의됨:

1. **Scalability** — brand 가 50+ 까지 늘어났을 때 슬라이드다운 패널의 `flex-wrap` chip 펼침이 세로 무한 증식하여 지도 절반을 가린다. 탐색 도구 (검색창) 를 둘 공간도 없다.
2. **`loadingType` surface** — `SearchFilters.loadingType` (`'pin' | 'plate'`) 슬롯이 idle. 백엔드 (`GymSearchRequest.loadingType`) + jOOQ enum (`LoadingType`) + 프론트 service (`gym-search.ts:36`) 까지 plumbing 완료 상태로 UI 진입점만 부재.
3. **활성 필터 가시성 + reset** — `FilterButton` 단일 카운트 뱃지만으로는 무엇이 켜져있는지 알 수 없음. `useFilters.setAll(INITIAL_FILTERS)` 는 코드상 존재하지만 UI 진입점 부재.

타이밍: Tier 1 (README 의 "Immediate value, no dependencies") 위치 그대로. App Store 게이팅이나 외부 의존성 없는 순수 frontend Task. Task 45 (gym_machine report target) 보다 먼저 처리하는 이유 = Task 45 는 backend + admin UI 두 영역에 걸친 modest scope 이고 Task 44 는 사용자 가시 가치가 즉시 들어옴.

### Grilled decisions (locked before code entry)

1. **Scope = ADR 0020 의 슬라이드다운 패널 supersession.** brand/category multi-select 자체는 Task 38b 에서 완료. Task 44 의 작업 범위는 (a) BottomSheetModal 패턴으로 UI 컨테이너 교체, (b) `loadingType` UI 노출, (c) 활성 필터 strip + 전체 해제 footer 등 성숙도 갭. ADR 0020 의 "bottom sheet 중첩 제스처 충돌 회피" 결정은 `useBottomSheetMode` 훅 (Task 38b 도입) 으로 해결 가능하므로 ADR 0021 로 supersession.
2. **Snap points = `['65%', '90%']` 듀얼 + pan-down-to-close.** 65% 는 시트 + 지도 부분 가시성 유지 → 결과 미리보기. 90% 는 긴 brand 리스트 스캔 편리. 단일 snap (`['90%']`) 대비 사용자 의도에 따라 자유 조절 가능. `@gorhom/bottom-sheet` 1차 시민 기능.
3. **SegmentedControl 위치 = 시트 내부.** floating (FilterButton 옆 항상 노출) 은 한 번의 탭을 절약하지만 필터 UI 의 single-source-of-truth 가 깨진다. 사용자 mental model 일관성을 위해 시트 내부.
4. **검색 임계치 = ≥ 8 (prop 으로 override).** 항상 노출은 2-3 항목 섹션에서 시각 노이즈. 임계치 기반 + `searchThreshold` prop 으로 섹션별 명시 override 가능. brand 는 50+ 예상 → searchable, category 는 15-25 예상 → 8 이하면 미노출 / 이상이면 노출.
5. **Draft/Applied 분리 안 함.** 일반적으로 더 솔리드한 패턴이지만 지도 필터에서는 live-preview 가 즉각 피드백을 제공하는 UX 가치가 더 큼. "전체 해제" 가 over-filter escape hatch 역할.
6. **brand/category 정렬 = 데이터 계층에서 `localeCompare('ko')`.** 컴포넌트에서 정렬하지 않음. `useBrands` / `useCategories` 의 `select` 옵션에서 처리 → 모든 consumer (FilterSheet, NL Search interpretation chip, AdminPhotoScreen 등) 가 동일 순서 보장.
7. **View-model 분리.** `toActiveFilters(filters, brands, categories): ActiveFilter[]` 순수 함수로 활성 필터 strip 의 view-model 을 분리. `ActiveFilterStrip` 은 view-model 만 받음 → brand/category 모델에 결합하지 않음. FF coupling 감소.

### Approach

**브랜치**: `task/44-filter-sheet` (이미 main 에서 fork 됨, no rebase coordination).

새 컴포넌트 + 기존 패널 교체:

1. `src/shared/components/SegmentedControl.tsx` — 재사용 가능 segmented control primitive (3+ 세그먼트, single-select, reanimated 슬라이딩 하이라이트, `accessibilityRole="tablist"`, reduced-motion 즉시 점프).
2. `src/features/map/lib/active-filters.ts` — `toActiveFilters` 순수 함수 + `ActiveFilter` type.
3. `src/features/map/components/ActiveFilterStrip.tsx` — view-model 입력으로 가로 스크롤 가능 칩 strip, 각 칩 우측 × 으로 제거.
4. `src/features/map/components/FilterSheetSection.tsx` — 헤더 + 옵션 검색 input (`searchThreshold` 기준) + chip wrap.
5. `src/features/map/components/FilterSheet.tsx` — `BottomSheetModal` 메인 시트, snap `['65%', '90%']`, footer (전체 해제 + 확인).
6. `src/features/map/hooks/useFilters.ts` — `setLoadingType: (loadingType: LoadingType | null) => void` 추가.
7. `src/features/map/hooks/useBrands.ts` / `useCategories.ts` — `select` 옵션에 `localeCompare('ko')` 정렬.
8. `src/features/map/components/MapScreen.tsx` — `FilterPanel` 사용처를 `FilterSheet` ref-based 호출로 교체, `GymBottomSheet` 와 좌표화.
9. 삭제: `src/features/map/components/FilterPanel.tsx` + `__tests__/FilterPanel.test.tsx`.

### Slice breakdown

review-gated subagent-driven development 패턴. 7 슬라이스 + 옵션 chore. 단일 PR (~600 LOC across ~18 files, Task 36 PR #76 동급).

| Slice   | 커밋 메시지                                                            | 내용                                                                                                                    |
| ------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 44a     | `docs(phase-4): 44a — Task 44 entry + ADR 0021 + 0020 superseded`      | 이 entry, ADR 0021 신규, ADR 0020 status, PROGRESS.md, README scope #7 정정                                             |
| 44b     | `feat(phase-4): 44b — SegmentedControl shared primitive`               | `SegmentedControl.tsx` + tests. Reanimated 슬라이딩 하이라이트, reduced-motion fallback, `accessibilityRole="tablist"`. |
| 44c     | `feat(phase-4): 44c — useFilters setLoadingType + alphabetical sort`   | `useFilters.setLoadingType` 추가, `useBrands` / `useCategories` `select` 정렬, tests.                                   |
| 44d     | `feat(phase-4): 44d — toActiveFilters view-model + ActiveFilterStrip`  | view-model 순수 함수 + 컴포넌트 + tests.                                                                                |
| 44e     | `feat(phase-4): 44e — FilterSheetSection (searchable, threshold)`      | 헤더 + 옵션 검색 + chip wrap + tests.                                                                                   |
| 44f     | `feat(phase-4): 44f — FilterSheet shell (BottomSheetModal, dual-snap)` | 메인 시트 조립, footer with safe-area, tests.                                                                           |
| 44g     | `feat(phase-4): 44g — wire FilterSheet, remove FilterPanel`            | MapScreen 통합, `GymBottomSheet` 좌표화, `FilterPanel` 삭제, Maestro flow 추가.                                         |
| (chore) | `chore(phase-4): 44 — coverage exclusions cleanup`                     | jest.config.js coverage exclusions 정리 (필요 시만).                                                                    |

### Token / cost spend for Task 44

- Vision API: 0.
- Groq: 0.
- 신규 runtime 비용: 없음 (RPC payload 동일, `loadingType` 컬럼은 이미 인덱스됨).

### Verification

1. `pnpm lint && pnpm exec tsc --noEmit && pnpm jest` — 484/484 + 신규 테스트 (예상 +25 ~ +35).
2. `/verify` 슬래시 커맨드 (FF review 4개 reviewer 포함) — Task 가 `src/` + `app/` 다수 변경하므로 필수.
3. `pnpm e2e:flow .maestro/flows/filter-sheet-flow` — 신규 E2E flow 1회 수동 실행.
4. 시뮬레이터 수동 스모크: 필터 버튼 탭 → 시트 65% snap → drag-up 90% → 로딩 방식 segmented control 토글 → 활성 strip 갱신 → 브랜드 검색 input 동작 → 칩 다중 선택 → 활성 strip × 으로 제거 → 전체 해제 → pan-down 닫힘.
5. 백엔드 무변경 → `./gradlew test` 실행 불필요.

## Task 45 — 머신 템플릿 필터 + 카테고리 라벨 정정 (ADR 0022)

### Why now

Task 44 (ADR 0021) 가 FilterSheet 구조 업그레이드 후 머지 직후, 사용자 시뮬레이터 실기 테스트에서 두 문제 표면화:

1. **카테고리 라벨 mislabel**: 시트의 "머신 종류" 섹션이 실제로는 `categories` 테이블 (`'등'`, `'가슴'`, Arms / Back / Chest / Legs / Shoulders) = **신체 운동 부위** 정보. 진짜 머신 종류 (Chest Press, Seated Row 등) 는 `machine_templates` 테이블에 별도 존재.
2. **Compound brand × machine 쿼리 표현 불가**: 사용자가 "Panatta 의 High Row + Low Row + Hex Squat 와 Hammer 의 Chest Press 를 모두 보유한 헬스장" 같은 정확 쿼리를 표현하려 하면, (브랜드 multi-select OR + 머신이름 deduplicated OR) 모델에서 cross-product fan-out 발생 → 의도와 SQL 의미 불일치.

두 증상은 ADR 0020 이 Phase 1 에서 명시적으로 deferred 했던 "머신 모델 멀티셀렉트 검색" 항목과 동일 뿌리. NL Search (Task 38b) 백엔드는 이미 `SearchDsl.machineFilters` + `templateIds` + `scope: EACH | COMBINED` 지원 → structured filter UI 만 노출되지 않은 상태.

### Grilled decisions (locked before code entry)

ADR 0022 본문 참조. 핵심 7결정:

1. 카테고리 라벨 "머신 종류" → **"운동 부위"** (실제 데이터와 일치)
2. 신규 **"머신"** 차원 추가, 시트 섹션 순서 = 운동 부위 → 브랜드 → 머신
3. 머신 chip 단위 = **per-template** (브랜드 prefix 라벨 `"Panatta High Row · 핀"`). name-deduplicated 거부 (cross-product 의미 모호)
4. 다중 머신 선택 **OR 디폴트 + 2+ 선택 시 AND 토글** `"선택한 머신 모두 보유한 헬스장만"`. backend `scope: EACH | COMBINED` 매핑
5. 글로벌 **LoadingType SegmentedControl 제거**. chip 라벨에 텍스트 suffix `"· 핀"` / `"· 플레이트"` 흡수
6. **브랜드 필터 섹션 유지** (직교). "이 브랜드의 머신 (아무거나) 보유" 광역 빠른 필터 use case
7. NL Search `parsedFilters.templateIds + scope` → 머신 chip + AND 토글 **lossless 매핑**. Task 38b 의 dropped condition 토스트가 머신/scope 항목 제거

추가 UX 결정:

- 머신 섹션 검색 input = **임계치 0** (항상 노출, 200-400 templates 예상)
- 정렬 = **브랜드 1차 + 이름 2차** (`useBrands` locale-aware 정렬 패턴과 일관)
- ActiveFilterStrip: 머신 chip + AND 모드 시 끝에 `"🔗 모두 보유 ×"`
- GymBottomSheet 카드: `"매칭된 머신: A, B 외 +N"` 미리보기 (top 5)

### Approach

**브랜치**: `task/45-machine-template-filter` (main `bb74a58` 에서 fork).

**Backend** (Spring Boot + jOOQ): DTO 확장 + SQL OR/AND 분기 + matched machines 응답 + JOOQ regen.
**Frontend** (React Native): types/hook 확장 + 라벨 정정 + 신규 머신 섹션 + LoadingType 제거 + AND 토글 + ActiveFilterStrip 확장 + NL 통합 + GymCard 매칭 머신 prefix.

### Slice breakdown

9 review-gated slices, ~800-1000 LOC across ~25 files, Task 36 PR #76 동급.

| Slice | 커밋 메시지                                                                             | 내용                                                                                                                                                                            |
| ----- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 45a   | `docs(phase-4): 45a — Task 45 entry + ADR 0022 + Task renumber`                         | ADR 0022 신규, ADR 0020 implementation note, implementation.md Task 45 entry + Future Tasks renumber (45→46 등), PROGRESS Status + Task 44 closeout + 재배치, README scope 갱신 |
| 45b   | `feat(phase-4): 45b — GymSearchRequest templateIds + scope, drop loadingType`           | DTO 변경 (`templateIds: List<String>`, `scope: SearchScope`, `loadingType` 제거), 1-pass IT spec lock                                                                           |
| 45c   | `feat(phase-4): 45c — GymRepository templateIds OR/AND SQL`                             | `searchInBounds` 에 templateIds 조건 추가. OR = `mt.ID.in(...)`. AND = `HAVING COUNT(DISTINCT CASE WHEN mt.ID IN (...) THEN mt.ID END) = N` 패턴. IT 케이스 추가                |
| 45d   | `feat(phase-4): 45d — matchedMachineNames in GymWithMachineCountResponse`               | response DTO 에 `matchedMachineNames: List<String>` (top 5, "브랜드 + 머신명"). SQL `array_agg` (LIMIT 5). IT 검증                                                              |
| 45e   | `chore(phase-4): 45e — regenerate jOOQ + OpenAPI + Orval client`                        | 자동 생성 산출물 분리 commit                                                                                                                                                    |
| 45f   | `feat(phase-4): 45f — useFilters templateIds + machineFilterMode + useMachineTemplates` | `SearchFilters` 확장, `useMachineTemplates` 신규 hook, `useFilters` 토글/세터                                                                                                   |
| 45g   | `feat(phase-4): 45g — UI relabel + machine section + AND toggle`                        | "머신 종류" → "운동 부위", 머신 섹션 신규, LoadingType SegmentedControl 제거, AND 토글, toActiveFilters + ActiveFilterStrip 확장                                                |
| 45h   | `feat(phase-4): 45h — NL parsedFilters full mapping`                                    | `applyParsedFiltersAndExitNl` 에 templateIds + scope→AND 매핑, `surfaceDroppedConditions` 갱신                                                                                  |
| 45i   | `feat(phase-4): 45i — GymCard matched machines prefix`                                  | GymBottomSheet card 에 매칭 머신 미리보기 줄 + Maestro flow 갱신                                                                                                                |

### Token / cost spend for Task 45

- Vision API: 0
- Groq: 0
- 신규 runtime 비용: 없음 (RPC payload 약간 증가, 인덱스 영향 없음)

### Verification

1. `pnpm lint && pnpm exec tsc --noEmit && pnpm jest` — 신규 테스트 +30~40 예상
2. `./gradlew test` — 신규 IT 케이스 +5~10 예상
3. `/verify` 슬래시 커맨드 (FF review 필수, src/ + app/ 다수 변경)
4. 시뮬레이터 수동 스모크: 머신 chip 선택 + AND 토글 + matched machines 표시 시각 확인 (사용자 외출 후 처리)
5. Maestro `filter-sheet-flow` 갱신 (LoadingType 검증 제거, 머신 차원 추가)

## Task 46 — gym_machine report target (moderation surface 확장)

### Why now

Task 45 가 완료되면서 머신 템플릿 필터 + 검색이 정밀해졌는데, 이제 **잘못된 gym_machine 매핑** (예: "이 헬스장의 Panatta High Row 는 실제로는 Hammer 의 High Row 임", "이 머신은 헬스장에 존재하지 않음") 이 검색 결과 품질을 해치는 다음 약점. 현재 reports 시스템은 photo-only — gym_machine 자체에 대한 신고 surface 가 없어 데이터 품질 이슈가 누적됨.

reports 테이블은 이미 polymorphic schema (`target_type TEXT NOT NULL`, `target_id UUID NOT NULL`) 라 schema migration 없이 확장 가능. 백엔드 hard-coded `target_type='photo'` 만 일반화하면 됨.

### Grilled decisions (locked before code entry)

1. **Scope = 둘 다 cover** ((a) 잘못된 template 매칭 + (b) 헬스장에 없음). 신고 사유로 분기, admin 액션 차별화 (`WRONG_TEMPLATE` → template_id 수정, `NOT_PRESENT` → 행 삭제).
2. **Task 45 머지 후 main 에서 fork**. Task 45 의 `/api/machine-templates` catalog endpoint 가 admin 의 "다른 머신으로 교체" picker 에 직접 필요. stacked PR (β) 의 rebase 부담 회피.
3. **ReportReason enum 신규 값 + UI subset**. `WRONG_TEMPLATE` / `NOT_PRESENT` 추가, frontend `ReportReasonSheet` 가 target_type 별 사유 subset 노출. 공유 enum (a) 거부 (사용자에 무관한 사진 NSFW 노출), 완전 분리 (별 enum) 도 거부 (`OTHER`, `LEGAL_PERSONAL` 같은 cross-cutting 사유 공유 유지가 좋음).
4. **Disposition cascade per target_type**. `applyActionedCascade(report)` 가 `report.targetType` switch:
   - `'photo' + actioned` → 기존 동작 (`photoRepository.setBlinded(true)` + uploader auto-ban 카운트)
   - `'gym_machine' + actioned + WRONG_TEMPLATE` → `gym_machines.template_id` 업데이트 (admin 이 picker 로 선택한 새 template_id 사용)
   - `'gym_machine' + actioned + NOT_PRESENT` → `gym_machines` 행 삭제 (FK cascade)
   - `'gym_machine' + actioned + OTHER` → admin 의 명시적 선택 (둘 중 하나)
   - `'gym_machine' + dismissed` → no cascade
5. **Reporter auto-ban counter 는 단일 공유**. `countDismissedByReporter` 가 target_type 무관 dismissed 합산. 회피성 abusive reporter 가 surface 간 분산 신고하는 패턴 방지.
6. **Admin 큐 = 통합** (photo + gym_machine 한 리스트, type 인디케이터). `AdminQueueItem` 통합 DTO 도입 (type, targetId, label, pendingReportCount, oldestReportAt, topReason). 기존 `AdminQueuePhotoSummary` 는 일반화로 교체.
7. **사용자 신고 진입점 = `MachineList` overflow icon**. 각 row 우측에 "..." 아이콘 → 탭 시 `ReportReasonSheet` 오픈 (target_type='gym_machine' 모드, 사유 subset = WRONG_TEMPLATE / NOT_PRESENT / OTHER).
8. **`AdminGymMachineScreen` 신규**. `AdminPhotoScreen` 패턴 따라 별도 화면 (route `ADMIN_ROUTES.gymMachine(id)`). 표시: gym name + 현재 template (브랜드 + 머신명 + 로딩) + pending reports + 3 액션 버튼 (`다른 머신으로 교체` / `이 머신 삭제` / `신고 기각`).
9. **ADR 없음**. reports 스키마 polymorphic + ReportReason enum 확장은 기존 패턴 따름, architectural 결정 없음. Task 46 entry 만 충분.

### Approach

**Backend**:

- `ReportReason` enum: 신규 `WRONG_TEMPLATE`, `NOT_PRESENT` 추가. `INAPPROPRIATE` / `WRONG_MACHINE` / `DUPLICATE` / `OTHER` / `LEGAL_PERSONAL` 유지 (photo 용).
- `ReportRepository.TARGET_TYPE_GYM_MACHINE = "gym_machine"` 상수. `submitReport` 메서드가 target_type 파라미터 받음 (또는 별 메서드 `submitGymMachineReport`).
- `AdminService.disposeReport` switch by target_type. `applyGymMachineActionedCascade` 신규 (`updateTemplateId` / `deleteGymMachine` 분기).
- `AdminQueueItem` DTO (`AdminQueuePhotoSummary` 대체).
- `gym_machines` 행 삭제 시 FK 영향 점검: `machine_photos.gym_machine_id` 가 참조 → ON DELETE 정책 필요 (CASCADE vs SET NULL). 일단 CASCADE (관련 사진도 의미 없어짐). 단, 이미 reports 가 photo 대상이면 photo 신고 따로 처리됨.

**Frontend**:

- `ReportReasonSheet` 일반화: `targetType: 'photo' | 'gym_machine'` prop, `targetId` 일반화 (기존 `photoId` 대체), 사유 subset 자동 필터링.
- `MachineList` row 에 overflow icon ("..." 또는 MaterialIcons `more_vert`) → onPress → ReportReasonSheet open.
- `AdminQueueScreen` 통합 큐 렌더: type 별 thumbnail/label 분기, navigate 분기 (`navigateToPhoto` vs `navigateToGymMachine`).
- `AdminGymMachineScreen` 신규: gym + template 디테일, 3 액션 버튼, template picker modal (Task 45 의 `useMachineTemplates` 재사용).

### Slice breakdown

9 review-gated slices, ~700-900 LOC across ~20 files. Task 45 동급 또는 약간 작음.

| Slice | 커밋 메시지                                                         | 내용                                                                                                                                                                      |
| ----- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 46a   | `docs(phase-4): 46a — Task 46 entry + PROGRESS Task 45 closeout`    | 이 entry, PROGRESS Status + Task 45 SHA + 체크박스, Future Tasks Task 45/46 라인 정정                                                                                     |
| 46b   | `feat(phase-4): 46b — ReportReason enum + gym_machine target_type`  | `ReportReason.WRONG_TEMPLATE` / `NOT_PRESENT` 추가, `ReportRepository` 의 target_type 일반화 (`TARGET_TYPE_GYM_MACHINE` 상수 + 메서드)                                    |
| 46c   | `feat(phase-4): 46c — Admin disposition cascade per target_type`    | `AdminService.disposeReport` switch, `applyGymMachineActionedCascade` (updateTemplateId / deleteGymMachine 분기), admin endpoint 시그니처 확장 (옵션 newTemplateId param) |
| 46d   | `feat(phase-4): 46d — AdminQueueItem unified DTO`                   | `AdminQueueItem` (type, targetId, label, pendingReportCount, oldestReportAt, topReason) → `AdminQueuePhotoSummary` 대체. queue SQL 의 group by target_type+target_id      |
| 46e   | `chore(phase-4): 46e — regenerate openapi + Orval client`           | 자동 생성 산출물 + minimal compile-fix                                                                                                                                    |
| 46f   | `feat(phase-4): 46f — ReportReasonSheet target_type generalization` | `ReportReasonSheet` 의 props 일반화 (`targetType`, `targetId`), 사유 subset 자동 필터 (reportReasons.ts), useReport hook 의 mutate 일반화                                 |
| 46g   | `feat(phase-4): 46g — MachineList overflow report entry`            | `MachineList` row 의 overflow "..." 아이콘 + ReportReasonSheet 진입                                                                                                       |
| 46h   | `feat(phase-4): 46h — Admin queue unified + AdminGymMachineScreen`  | `AdminQueueScreen` type 분기 렌더, 새 `AdminGymMachineScreen` (gym + template + 3 액션 + template picker modal)                                                           |
| 46i   | `feat(phase-4): 46i — verification + Maestro flow`                  | Maestro flow (gym detail → "..." → report sheet), unit/IT 마무리, /verify + 가능 시 FF review fixes                                                                       |

### Token / cost spend for Task 46

- Vision API: 0
- Groq: 0
- 신규 runtime 비용: 없음 (FK CASCADE 가 가장 큰 항목, gym_machine 삭제 시 photos 처리)

### Verification

1. `pnpm lint && pnpm exec tsc --noEmit && pnpm jest` — 신규 테스트 +20~30 예상
2. `./gradlew test` — 신규 IT +5~8 예상 (ReportRepository, AdminService gym_machine path, queue 통합)
3. `/verify` 슬래시 커맨드 (FF review 4 reviewer)
4. 시뮬레이터 수동 스모크: gym detail → 머신 row "..." → 신고 → admin 큐에 진입 → admin gym_machine screen → 3 액션 검증
5. Maestro flow `.maestro/flows/gym-machine-report-flow.yaml` 신규 또는 기존 flow 확장

## Task 47 — Gym owner workflow (사업자등록증 OCR 인증 + 모더레이션 분산 + trust signal)

### Why now

Task 46 까지의 모더레이션 흐름은 admin 한 명 (현재 사용자 본인) 에게 집중됨. Pre-launch 시점에 owner 모집단 작아 분산 효과 즉시 측정은 어렵지만, 인프라를 미리 깔지 않으면 출시 후 모더레이션 backlog 가 첫 병목이 됨. 또한 Phase 2 Task 30 (PR #45) 이 `users.role = 'owner'` enum value 를 프로덕션 CHECK constraint 에 사전 추가했지만 워크플로우는 미설계 상태 (Phase 2 carry-over gap #4). `init-test-db.sql` 의 schema drift (`('user', 'admin')` 만 허용) closeout 도 본 Task 의 일부.

Phase 4 README scope item 13 의 두 가치 — (a) moderation 분산, (b) trust signal — 을 본 Task 가 정식 구현. ADR 0023 에서 6 design branch (Q1-Q6) 잠금.

### Grilled decisions (locked before code entry, ADR 0023)

1. **Q1 인증 = U (사업자등록증 OCR + 국세청 진위확인 자동 검증)**. 사업자등록증 사진 → Vision API OCR → 국세청 진위확인 → 매칭 시 즉시 grant. 사진 인메모리 처리 (Task 42 OcrService 패턴 재사용) → 디스크 X. 사업자번호 SHA-256 hash 저장. 비용 거의 0원/년.
2. **Q2 스키마 = B (`gym_owners` 조인 테이블, 공동 owner 자동 허용, soft delete)**. 1:1 / N:1 (체인) / 1:N (공동) 모두 지원. 같은 사업자번호 hash → 공동 owner 자동. 다른 hash → admin 분쟁. `revoked_at TIMESTAMPTZ` soft delete.
3. **Q3 권한 = P3 (사진 verify + 머신 인벤토리 CRUD + 자기 gym 신고 first-look)**. 자기 gym 한정. self-interest risk 는 Q4 audit + Q5 W1 의 audit Slack 으로 사후 detect.
4. **Q4 큐 = A2+B3+C2+C3+D2+E3**. 별도 endpoint `/api/owner/queue`, sequential 24h + SafeSearch 긴급 fast-track, DB audit_log + Slack 실시간, reporter 수동 이의제기 (`MyReportsScreen`), 머신 즉시 반영 + soft delete.
5. **Q5 trust = T1+T2+T3+W1+경고+가시화**. Photo verified 뱃지 (manual + auto-by-owner-upload), Gym 카드 owner-claimed 뱃지, 자기 gym 신고 auto-action, ReportReasonSheet amber banner, GymCard 뱃지.
6. **Q6 UI = U1+E1+E3+E4+E5+R3**. 별도 `app/owner/` 트리. 진입점: Profile 메뉴 + Gym detail + **Profile 위젯 (E4) + Tab dot badge (E5)** (Push 미구현 fallback). 등록: Gym detail (primary) + Profile 메뉴.

추가 UX 결정 (Q6 sub):

- 사업자등록증 업로드 = 카메라 + 갤러리 둘 다.
- PIPA 동의 체크박스 = 사진 업로드 _전_.
- Loading state = Skeleton + "검증 중... 10초 정도 걸려요" + 30초 타임아웃.
- 머신 삭제 confirmation = Action Sheet + soft delete 메시지.

### Approach

**데이터 모델**:

- `users.role` CHECK 정렬 `('user', 'admin', 'owner')` (test schema 만, prod 는 Phase 2 Task 30 에서 이미 적용)
- 신규 테이블: `gym_owners`, `moderation_audit_log`
- 신규 컬럼: `reports.owner_timeout_at`, `machine_photos.verified_by_owner_at`, `gym_machines.deleted_at`

**Backend**:

- 신규 패키지 `com.ironspot.owner`: `OwnerController`, `OwnerService`, `GymOwnerRepository`, `BusinessRegistrationVerifier`, `OwnerClaimController`.
- 신규 endpoint: `POST /api/owner/claim` (사진 multipart), `GET /api/owner/queue`, `POST /api/owner/reports/{id}/disposition`, `POST /api/owner/photos/{id}/verify`, owner 권한 `POST/PUT/DELETE /api/gym-machines`, `POST /api/reports/{id}/escalate`.
- `OcrService.analyzeBusinessRegistration(byte[])` 메서드 신규 (TEXT_DETECTION + DOCUMENT_TEXT_DETECTION).
- 국세청 진위확인 API client `BusinessRegistryClient` (WebClient, env `NTS_BUSINESS_API_KEY`).
- `ReportService` 분기: reporter 가 target gym 의 active owner → 즉시 actioned (Q5 W1).
- `AdminNotificationService.notifyOwnerAction` 신규 (Q4 C3 Slack).
- Cron job `OwnerTimeoutEscalationJob` (`@Scheduled(fixedDelayString = "PT5M")`) — owner_timeout_at < NOW() + status='pending' → admin queue 노출.
- 권한 검증: `@PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")` + service-layer `gym_owners` 매칭.

**Frontend**:

- 신규 디렉토리 `src/features/owner/components/*` + `src/features/owner/hooks/*`.
- 신규 라우트 `app/owner/_layout.tsx` (OwnerGuard) + `app/owner/index.tsx` + `app/owner/claim.tsx` + `app/owner/queue.tsx` + `app/owner/machines/[gym].tsx` + `app/owner/machines/[gym]/[id].tsx` + `app/owner/machines/[gym]/new.tsx` + `app/owner/photos/[gym].tsx`.
- 신규 화면 `app/my-reports.tsx` (Q4 D2).
- 확장: `ProfileScreen` (E4 위젯 + E1/R1 메뉴), `(tabs)/_layout.tsx` (E5 dot badge), `GymDetailScreen` (E3 + R2 버튼), `GymCard` (owner 뱃지), `ReportReasonSheet` (amber banner).
- Codegen: openapi.json regen + Orval regen.

### Slice breakdown

12 review-gated slices + 1 chore. Task 33-34 동급. ~1200-1500 LOC across ~40-50 files. **Plan deviation from initial draft**: original 47b ("schema") split into 47b (Flyway scaffolding) + 47c (Task 47 schema + JOOQ regen) for review-gate atomicity — separating Flyway infra introduction from feature schema makes the prod-first-deploy risk surface auditable in isolation. Downstream slices shift by one letter (47c-47l → 47d-47m).

| Slice | 커밋 메시지                                                                    | 내용                                                                                                                                                                                                                                                                                       |
| ----- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 47a   | `docs(phase-4): 47a — Task 47 entry + ADR 0023 + PROGRESS Task 46 closeout`    | 이 entry, ADR 0023, PROGRESS Status 라인 정리 + Task 46 SHA/체크박스, ADRs README 0021/0022/0023 추가                                                                                                                                                                                      |
| 47b   | `feat(phase-4): 47b — Flyway setup + V1 baseline snapshot`                     | `org.flywaydb:flyway-core` + `flyway-database-postgresql` deps, `application.yml` `baseline-on-migrate=true` + `baseline-version=1`, test 프로파일은 `flyway.enabled=false` (Testcontainers + init-test-db.sql 유지), `V1__baseline.sql` (현 prod schema 스냅샷, idempotent IF NOT EXISTS) |
| 47c   | `feat(phase-4): 47c — V2 Task 47 schema + JOOQ regen`                          | `V2__task47_gym_owner.sql` (users.role CHECK + gym_owners + moderation_audit_log + reports.owner_timeout_at + machine_photos.verified_by_owner_at + gym_machines.deleted_at), `init-test-db.sql` 동기, JOOQ regen. 모든 ALTER 는 IF NOT EXISTS idempotent.                                 |
| 47d   | `feat(phase-4): 47d — BusinessRegistrationVerifier + 국세청 API client`        | `BusinessRegistryClient` WebClient, `BusinessRegistrationVerifier` (OCR + 진위확인 + 매칭 로직), env `NTS_BUSINESS_API_KEY` 추가, IT (mock WireMock + Vision mock)                                                                                                                         |
| 47e   | `feat(phase-4): 47e — OwnerController + claim endpoint`                        | `POST /api/owner/claim` (multipart, 동의 검증, 인메모리 OCR, `gym_owners` insert, role grant, audit_log + Slack), 공동 owner 자동 허용 / 다른 hash 분쟁 큐, IT +5                                                                                                                          |
| 47f   | `feat(phase-4): 47f — Owner queue + first-look + auto-action`                  | `GET /api/owner/queue`, `POST /api/owner/reports/{id}/disposition`, ReportService 의 자기 gym auto-action 분기 (Q5 W1), `OwnerTimeoutEscalationJob` cron, IT +5                                                                                                                            |
| 47g   | `feat(phase-4): 47g — Owner machine CRUD + photo verify + reporter escalation` | owner 권한 `POST/PUT/DELETE /api/gym-machines` (`gym_owners` 매칭), `POST /api/owner/photos/{id}/verify`, `POST /api/reports/{id}/escalate` (reporter), soft delete 적용, IT +6                                                                                                            |
| 47h   | `chore(phase-4): 47h — regenerate openapi.json + Orval client`                 | 신규 endpoint + DTO 일괄 코드젠, minimal compile-fix                                                                                                                                                                                                                                       |
| 47i   | `feat(phase-4): 47i — OwnerClaimScreen (사업자등록증 OCR flow)`                | `app/owner/claim.tsx` + 카메라/갤러리 picker + PIPA 동의 체크박스 + Skeleton + 결과 화면, expo-image-picker 활용, Jest +8                                                                                                                                                                  |
| 47j   | `feat(phase-4): 47j — OwnerGuard + owner queue/machines/photos screens`        | `OwnerGuard`, `app/owner/_layout.tsx`/`index.tsx`/`queue.tsx`/`machines/*.tsx`/`photos/*.tsx`, FlatList + swipe + FAB, Action Sheet 삭제 확인, Jest +15                                                                                                                                    |
| 47k   | `feat(phase-4): 47k — trust signal UI (GymCard 뱃지 + ReportReasonSheet 경고)` | GymCard 의 owner-claimed 뱃지, `verified_by_owner_at` 뱃지 (PhotoCard), ReportReasonSheet 의 amber banner, `useOwnerStatus` 훅, Jest +5                                                                                                                                                    |
| 47l   | `feat(phase-4): 47l — Profile 위젯 + Tab dot badge + Gym detail 진입점`        | `ProfileScreen` 의 owner 활동 위젯 (E4) + 메뉴 항목 (E1/R1), `(tabs)/_layout.tsx` 의 dot badge (E5), `GymDetailScreen` 의 "owner 도구" + "내 매장이에요" 버튼 (E3/R2), Jest +7                                                                                                             |
| 47m   | `feat(phase-4): 47m — MyReportsScreen + Maestro flows + e2e-strategy`          | `app/my-reports.tsx`, `useMyReports` hook, `.maestro/flows/owner-claim-flow.yaml` + `owner-moderation-flow.yaml`, `docs/harness/e2e-strategy.md` Task 47 행, Jest +4                                                                                                                       |

### Token / cost spend for Task 47

- Groq: 0 (no NL calls)
- Vision API: 추정 +100 units/월 (owner 인증 50건 × 2 features), Task 42 free tier 1000 units/월 공유, 초과분 ~200원/월 max
- 국세청 진위확인 API: 0원 (공공데이터포털 무료)
- SMS/storage: 0원 (Q1 F 거부, 인메모리 처리)
- 예상 PIPA 컴플라이언스 추가 작업: Pre-Launch Backlog 의 Privacy Policy + ToS 에 1줄 추가

### Verification

1. `pnpm lint && pnpm exec tsc --noEmit && pnpm jest` — 신규 테스트 +35~45 예상
2. `./gradlew test` — 신규 IT +16~20 예상 (OwnerClaim / OwnerQueue / Verifier / cron job / 권한 매트릭스)
3. `/verify` 슬래시 커맨드 (FF review 4 reviewer 필수, src/ + app/ 다수 변경)
4. 시뮬레이터 수동 스모크: 사업자등록증 fixture 사진 → claim flow → owner queue 진입 → 머신 CRUD → trust signal 가시화 확인
5. `pnpm e2e:flow .maestro/flows/owner-claim-flow` + `owner-moderation-flow`
6. Slack `#ironspot-moderation` 채널에 owner action 알림 도착 확인 (수동 1회)

### 의존성 + risk

- 의존성: Task 48 (Apple Sign In) 와 Task 49 (admin-flow Maestro) 와 독립
- Risk 1: 국세청 진위확인 API 응답 형식 불안정 가능성 (공공 API 일반적 risk) → IT 에 WireMock 으로 응답 변형 케이스 5개 이상 커버
- Risk 2: PIPA 동의 문구 법적 검토 (Pre-Launch Backlog Privacy Policy 작업과 함께 진행)
- Risk 3: Vision API free tier 초과 시 비용 (월 1000 units 공유) → Task 42 + Task 47 합쳐 1100+ units 시점에 monitoring 필요

## Future Tasks (planned order, locked via Task 42 grill follow-up)

The remainder of Phase 4 has a recommended order derived from dependency + cost analysis (not the README ordering, which is unsorted scope). Each Task still gets its own `grill-me` + plan entry before implementation; this list is the queue not the design.

### Tier 1 — Immediate value, no dependencies

- **Task 44** (done, PR #87 merged): FilterPanel scalability + `loadingType` surface (ADR 0021) — brand/category multi-select 는 Task 38b 에서 이미 완료. 본 Task 는 (a) brand/category 가 50+ 까지 늘어났을 때의 overflow 대응 + (b) `loadingType` UI 노출 + (c) 활성 필터 가시성/리셋 부재 등 Phase 1 패널의 성숙도 갭을 닫음.
- **Task 45** (done, PR #88 merged): 머신 템플릿 필터 + 카테고리 라벨 정정 (ADR 0022) — Task 44 머지 직후 사용자 시뮬레이터 테스트에서 표면화된 두 문제 closeout. ADR 0020 이 Phase 2/3 으로 deferred 했던 "머신 모델 멀티셀렉트 검색" 항목의 Phase 4 구현.
- **Task 46**: gym_machine report target — see full section below. Reports 시스템을 photo-only 에서 gym_machine 까지 확장하여 잘못된 머신 매핑을 사용자가 신고 + admin 이 재매핑/삭제 가능하게 함. crowd-source 데이터 품질 surface. Backend (ReportReason 확장 + per-target_type disposition cascade + 통합 큐 DTO) + Frontend (`ReportReasonSheet` 일반화 + `MachineList` 신고 진입점 + `AdminGymMachineScreen` 신규) 9 슬라이스.

### Tier 2 — Substantive moderation + launch gating

- **Task 47**: Gym owner workflow — give gym owners scoped permissions to verify/approve photos and edit machine inventory for their gym. `users.role = 'owner'` already in prod CHECK constraint (Phase 3 prep, no migration). Distributes moderation load from admin queue, adds trust signal (owner-verified > anonymous). Largest Task in this tier (4-6 slices, comparable to Task 33-34). 6 design branches to grill at Task entry (owner verification path, permission scope, gym-to-owner cardinality, moderation flow re-design, UI, trust signal propagation).
- **Task 48**: Apple Sign In external wiring — App Store submission requires Apple Sign In option on iOS. Apple Developer Program enrollment ($99/year) is a user prerequisite. Supabase Apple provider + `ios.usesAppleSignIn` + real-device test. Unlocks the Maestro-driveable in-app sheet that Task 49 depends on.
- **Task 49**: admin-flow Maestro flow — depends on Task 48. Phase 3 verification carry-over (Task 40 deferred); closes the admin testing gap by using Apple Sign In as the Maestro-driveable login path. Small Task (1-2 slices).

### Operational (parallel, not numbered Tasks)

- **UptimeRobot keep-warm** — 5-min cron ping on `/actuator/health` to defeat Render free 15-min idle sleep. ~10 min total work (account + URL). Pre-launch operational.
- **Privacy Policy + Terms of Service** — Korean copy + hosted URLs + App Store Connect link. Content-bottleneck rather than code. Pre-launch legal.
- **EAS preview-simulator build** — depends on Task 47's Apple Developer enrollment side-effect. Once available, becomes the canonical preview-build path for live verification flows.
- **NL search query log infra** (D) — Phase 5 hypothesis H2 ("top decile of normalised queries accounts for >30% of monthly volume", drives NL query caching decision) needs query-level frequency data starting from launch day 1. Shipping pre-launch as operational infra rather than deferring to Phase 5 first task collapses the H2 decidability timeline by 4-8 weeks. See **NL search query log infra plan** section below for the full 13-decision grill outcome and the 6-slice implementation plan.

### NL search query log infra plan

#### Why now

Without a query-text audit table, Phase 5 NL query caching (item 5 in `docs/plans/phase-5/README.md`) is undecidable. The Phase 4 `users.nl_search_count_month` counter (Task 37) tracks per-user volume only — no insight into which queries repeat. H2 needs hash-of-normalised-text frequency, which the current observability layer (Sentry breadcrumb at `NlSearchService:92`) carries as ephemeral event data, not queryable analytics. Ship as a Phase 4 Operational item (not a numbered Task) because (a) cost is 0원 verified at expected and 100x growth, (b) work is small (6 slices, comparable to Task 42 PII detection), and (c) the value (4-8 week earlier H2 decidability) is asymmetric to the risk (one new table + retention cron + admin endpoint, all behind admin guard).

#### Locked decisions (grilled 2026-05-18)

| Q   | Decision                                                                                                                         | Why                                                                                                                                                 |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Store both `raw_query` and `normalised_query`                                                                                    | Sentry breadcrumb already ships raw text; adding our table marginal PII delta = 0. Raw enables retrospective re-normalisation when rules change.    |
| 2   | `user_id UUID REFERENCES users(id)` nullable, no cascade                                                                         | Matches `machine_photos` pattern. Account deletion path adds `anonymizeNlSearchLog` to `UserService.deleteAccount`.                                 |
| 3   | 90-day retention, hardcoded, daily cron at 04:00 KST                                                                             | 3 months covers monthly trend + first QoQ signal. PIPA "minimum necessary" friendly. Daily cron via `@Scheduled` mirroring `NlSearchQuotaResetJob`. |
| 4   | Admin endpoint (`GET /api/admin/nl-search-analytics`) + SQL view (`nl_search_analytics_30d`). Slack cron deferred.               | Pull-based for ad-hoc analysis. Slack push premature pre-launch (no signal).                                                                        |
| 5   | Pre-launch ship, Phase 4 Operational item (not numbered Task)                                                                    | See "Why now" above.                                                                                                                                |
| 6   | Normalisation: NFC + lowercase + collapse whitespace + drop trailing `[.?!~ㅋㅎ]+`. **No 조사 stripping.**                       | Memory `feedback_korean_natural_language` — preserve Korean semantics. Match what a realistic cache key would do.                                   |
| 7   | Write failure: silent + `log.warn` + Sentry warning. Search response stays 200.                                                  | Observability is not business logic. UX prioritised over consistency.                                                                               |
| 8   | 100% capture                                                                                                                     | At 15K rows / 90 days worst-case, sampling complexity unjustified.                                                                                  |
| 9   | Columns: `id`, `user_id`, `raw_query`, `normalised_query`, `outcome`, `total_count`, `duration_ms`, `filter_count`, `created_at` | Reuses breadcrumb signal fields. `parsed_filter_signature` deferred to Phase 5.                                                                     |
| 10  | Indexes: `(created_at)`, `(normalised_query, created_at)`, `(user_id)`                                                           | Retention prune + top-N aggregate + anonymise paths.                                                                                                |
| 11  | `REQUIRES_NEW` separate tx in `NlSearchService.search` finally block                                                             | Matches `NlSearchQuotaService.checkAndIncrement` pattern. Isolated from search's `readOnly = true` tx.                                              |
| 12  | Skip insert only on `business_error:429` (quota)                                                                                 | Quota-rejected queries never run pipeline. All other outcomes (success/dsl_error/runtime_error/other 4xx) logged.                                   |
| 13  | PIPA disclosure: add table row + retention line to `docs/legal/privacy-policy.ko.md` matching existing register                  | Section 2 table + Section 3 list. `.en.md` parallel translation.                                                                                    |

#### Slices

| Slice | Files                                                                                                                                                                                                                                                                                                                                                                                                                       | Description                                                                                                                                                                                                                                                                                                                                                                                 |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1    | `iron-spot-api/src/main/resources/db/migration/V3__nl_search_log.sql` (new), `iron-spot-api/src/test/resources/init-test-db.sql`, `iron-spot-api/build.gradle.kts` (JOOQ regen), generated `Tables.java`/`NlSearchLog.java`/etc, `docs/plans/phase-4/implementation.md` (this section), `docs/plans/phase-4/PROGRESS.md` (Operational row)                                                                                  | Schema migration: `nl_search_log` table (9 cols) + 3 indexes + `nl_search_analytics_30d` SQL view. Hand-mirror to test schema. JOOQ regen via `./gradlew generateJooq`. Plan entry (this section).                                                                                                                                                                                          |
| D2    | `iron-spot-api/src/main/java/com/ironspot/search/NlSearchLogRepository.java` (new), `iron-spot-api/src/main/java/com/ironspot/search/NlSearchLogWriter.java` (new), `iron-spot-api/src/main/java/com/ironspot/search/NlSearchService.java`, `iron-spot-api/src/test/java/com/ironspot/search/NlSearchLogWriterIT.java` (new)                                                                                                | `NlSearchLogRepository.insert(row)` JOOQ insert. `NlSearchLogWriter` separate `@Component` with `@Transactional(REQUIRES_NEW)` + `Normaliser.normalise(raw)`. `NlSearchService.search` finally block conditionally calls writer (skip on 429). Catches all exceptions from writer + emits `log.warn` + Sentry warning. IT: 3 cases (success row landed, dsl_error row landed, 429 skipped). |
| D3    | `iron-spot-api/src/main/java/com/ironspot/search/NlSearchLogRetentionJob.java` (new), `iron-spot-api/src/test/java/com/ironspot/search/NlSearchLogRetentionJobIT.java` (new)                                                                                                                                                                                                                                                | `@Scheduled(cron = "0 0 4 * * ?", zone = "Asia/Seoul")` `DELETE FROM nl_search_log WHERE created_at < NOW() - INTERVAL '90 days'`. `Sentry.captureMessage(INFO)` with deleted count. IT: 2 cases (90-day boundary, idempotent).                                                                                                                                                             |
| D4    | `iron-spot-api/src/main/java/com/ironspot/admin/AdminController.java` (extend), `iron-spot-api/src/main/java/com/ironspot/admin/AdminService.java` (extend), `iron-spot-api/src/main/java/com/ironspot/admin/dto/NlSearchAnalyticsResponse.java` (new), `iron-spot-api/openapi.json`, `src/shared/generated/admin/admin.ts` (Orval regen), `iron-spot-api/src/test/java/com/ironspot/admin/AdminControllerIT.java` (extend) | `GET /api/admin/nl-search-analytics?period=7d                                                                                                                                                                                                                                                                                                                                               | 30d | 90d`. Returns `{period, totalQueries, distinctNormalised, distinctUsers, topQueries: [{normalised, count, distinctUserCount}]}`top 20.`@PreAuthorize("hasRole('ADMIN')")` reused from Task 33 pattern. IT: 3 cases (admin 200, user 403, anonymous 401). OpenAPI + Orval regen. |
| D5    | `iron-spot-api/src/main/java/com/ironspot/auth/UserRepository.java` (extend), `iron-spot-api/src/main/java/com/ironspot/auth/UserService.java` (extend), `iron-spot-api/src/test/java/com/ironspot/auth/UserControllerTest.java` (extend)                                                                                                                                                                                   | `UserRepository.anonymizeNlSearchLog(userId)` = `UPDATE nl_search_log SET user_id = NULL WHERE user_id = ?`. `UserService.deleteAccount` extends pipeline: anonymizePhotos → deleteVotes → **anonymizeNlSearchLog** → markDeleted. Test: `deleteAccountAnonymisesNlSearchLog`.                                                                                                              |
| D6    | `docs/legal/privacy-policy.ko.md`, `docs/legal/privacy-policy.en.md`, `docs/plans/phase-4/PROGRESS.md` (Operational row closing), `docs/launch/pre-submission-checklist.md` (Section 5.1.1 declarations + Section 6 PIPA row note)                                                                                                                                                                                          | Privacy policy Section 2 table gets `자연어 검색 쿼리, 검색 시각` row. Section 3 gets `자연어 검색 쿼리 및 검색 시각: 수집일로부터 **90일**간 보유 후 파기합니다.` line. EN parallel. PROGRESS closes. Pre-submission checklist 5.1.1 declarations gains the new category note.                                                                                                             |

#### Verification

1. `./gradlew test` from `iron-spot-api/` — all backend ITs pass including 3 new (D2) + 2 new (D3) + 3 new (D4) + 1 new (D5) = +9 cases.
2. `pnpm lint && pnpm exec tsc --noEmit && pnpm jest` — frontend only touches Orval-regenerated client (D4); no hand-written FE.
3. `/verify` slash command if any frontend file touched (D4 Orval regen path triggers FE detection per Phase 4 PR conventions).
4. Live verification after merge: trigger one NL search via prod app, verify row appears in `nl_search_log`, verify admin endpoint returns it.

#### Token cost

- Groq/Gemini: 0 (no LLM calls; normalisation is deterministic per Q6).
- Storage: 3.75 MB worst-case at 90-day × 100/user/월 × DAU 50, far under Supabase 500 MB free tier.

#### Rollback

If a slice introduces regression: revert the commit. Schema is additive — `nl_search_log` table can be `DROP TABLE` without affecting other tables. The `UserService.deleteAccount` extension (D5) is the only non-additive change to existing behaviour; rollback drops the `anonymizeNlSearchLog` call but leaves the helper method idempotent for re-introduction.

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
