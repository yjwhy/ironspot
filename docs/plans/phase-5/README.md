# Phase 5 — Post-launch

Created at the close of Phase 4 as a holding pen for items deliberately deferred until the App Store launch has shipped and real users are exercising the app. No tasks are numbered yet; per project convention the Phase 5 kickoff happens via `grill-me` once a launch signal (App Store approval, then a measurable user base) is observable.

The deferral here is intentional: every item below is decidable only with real data, real abuse patterns, or real volume. Designing them pre-launch would be guessing twice (first the design, then which design assumption was wrong).

## Goal

Use the first cohort of real users to settle the open questions that Phase 4 had to leave as guesses, then ship the resulting features. Where Phase 4 closed the safety and gating items, Phase 5 closes the data-driven and optimisation items.

## Inherited scope (from Phase 4 Tier 3)

Migrated verbatim from `docs/plans/phase-4/implementation.md` `Future Tasks` Tier 3. Order is rough priority, not commitment.

1. **Reporter trust scoring plus auto-ban tuning** — current thresholds `actioned >= 3` and `dismissed >= 5` (Task 34) are guesses. Needs real abuse patterns. Task 47 owner workflow reduces urgency by distributing moderation load away from the auto-ban path.
2. **Appeal flow** — Phase 4 auto-ban is final. Once thresholds get tuned aggressively in item 1, banned users need a re-route into the admin queue.
3. **Voice live verification** — accept manual smoke on each release tag until either (a) a test-only voice fixture bypassing STT lands, or (b) EAS preview-simulator path becomes available (gated on Apple Developer enrolment per Phase 4 operational backlog).
4. **Push notifications** — admin dispositions and ban events as first triggers. Needs `expo-server-sdk-java` integration plus APNs cert plus a user base to actually notify.
5. **NL query caching** — LLM bypass for repeat queries. Phase 4 100/month/user quota already gates spend so caching is premature without query-frequency data.
6. **Standalone admin web UI (Next.js)** — needs moderation queue volume to justify duplicating mobile admin work. Task 47 owner workflow reduces urgency by distributing moderation load.
7. **PostHog analytics** — funnel plus retention. Question only becomes askable post-launch.
8. **Dark mode** — design tokens already abstracted (`tailwind.config.js`); needs a theme switch plus per-token dark variants.

## Inherited scope (from Phase 4 README Phase 5+ tier)

9. **Multi-platform push routing** — once item 4 lands on iOS, extend to Android once Play Store presence exists.
10. **ML reranking on NL search results** — current ordering is PostGIS distance plus filter match. Reranking based on user click-through plus dwell time only becomes possible with logged user interactions, which item 7 (PostHog) unlocks.

## Open questions raised during launch-readiness review (2026-05-19)

Surfaced by the user during device testing on the iOS simulator while reviewing the OCR pipeline and filter catalog. Both questions point at the same workflow gap: the closed-set template DB cannot grow from real-user submissions today, and the manual-input fallback that the UI promises is currently a no-op.

**Locked scope decision (2026-05-20)** — Korean users only. The launch cohort, the product surface, and every UX decision below assume the user is in Korea and reads Korean. Overseas usage is explicitly out of scope: any item that previously read "this is an overseas-tester edge case" is re-classified as a domestic concern (the developer's NZ testing surfaced item 13's symptom, but the underlying bug hits domestic users too). H6 ("Korean-only at launch is acceptable") is treated as confirmed pre-launch rather than waiting on App Store review evidence.

### 11. Machine template catalog growth plus OCR direct-input persistence

**Current state**

- `brands`, `categories`, `machine_templates` are seeded manually into Supabase prod (Flyway `V1__baseline.sql:21` explicitly excludes seeds). At launch the catalog is 5 brands + 5 categories + 11 templates.
- `OcrService` plus `FuzzyMatchService` only suggest templates that already exist in `machine_templates` (Jaccard threshold 0.25). OCR cannot self-register an unknown brand or machine.
- `UploadConfirmScreen.tsx:238` collects the user's free-text fallback name but `handleRegister` carries a `// TODO: call registerMachine(...)` and just shows a "사진이 등록됐어요!" toast plus `router.back()`. The text is **discarded**; only the photo lands in Storage plus `photos`, never bound to a `gym_machines` row. The user reads it as success but the photo becomes an orphan.
- Same gap applies when OCR succeeds but the suggested templates are all wrong and the user picks the "직접 입력" radio.

**To-do (groomed scope)**

- [x] Backend: add `POST /api/gym-machines` (or extend existing endpoint) that accepts `{ gymId, templateId? | freeFormName }` and persists into `gym_machines` with `template_id` filled when the user picked from the closed list, or `template_id = NULL` plus `pending_review = true` when the user fell back to direct input. → Shipped slice 1 on `hotfix/phase-5-item-11-gym-machine-persist`. Flyway V6 adds `pending_review BOOLEAN NOT NULL DEFAULT FALSE` plus partial index for the admin queue hot path. Controller validates exactly-one-of `templateId | freeFormName`, looks up `templateExistsAndApproved` so the closed-list path can't point at an admin-rejected template.
- [x] Backend: bind the orphaned photo to the new row inside the same request so the upload flow finishes with a real `gym_machine_id`. → `PhotoRepository.bindOrphanGymMachineId` only flips `gym_machine_id` when the current value is NULL, so a malicious client can't relocate an already-bound photo onto a new contribution row and silently vandalise prior contributions. Slice 2 changes `PhotoService.upload` to write NULL initially so the orphan-bind guard is reachable from the live flow.
- [x] Frontend: replace the `// TODO` in `UploadConfirmScreen.tsx:238` with a real call. Toast copy stays optimistic but reflects truth ("등록 요청을 보냈어요, 검토 후 반영돼요" or similar). → Shipped slice 2 on `hotfix/phase-5-item-11-frontend-wire`. `PhotoService.upload` now accepts optional `gymMachineId` (orphan upload lands under `<bucket>/orphan/<userId>/`); `UploadConfirmScreen.handleRegister` calls `useCreateGymMachine` with `{ gymId, templateId | freeFormName, photoId? }` where `photoId` is sent only on the orphan path (bound uploads would fail the slice-1 NULL guard). Toast copy splits on `pendingReview`: closed-list → "등록됐어요", direct input → "등록 요청을 보냈어요 · 검토 후 반영될 거예요". Synchronous `useRef` guard prevents double-submit. Out of slice 2: the legacy entry point (UploadGymSelect → tap existing machine) still creates a new contribution row when the user picks a non-matching template on the confirm screen — uniqueness handling deferred to slice 4 admin queue.
- [x] **OCR-failure picker UI (3 closed-list steps + escape hatch)** — replaces today's `OcrFailView` plain text input. See `Closed-list autocomplete pattern` below. → Shipped slice 3 on `hotfix/phase-5-item-11-slice-3-closed-list-picker`. New `MachinePicker` component drives progressive disclosure (brand search/list → 5 fixed category chips → template list filtered by brand+category) with a persistent "리스트에 없어요?" link that reveals the free-text fallback. Mounts on both OCR-fail (always) and OCR-success (when user taps the "다른 기구로 등록" radio). `UploadConfirmScreen` refactored to a discriminated `selection: { kind: 'none' | 'template' | 'freeForm' }` state model so the OCR-radio path and the picker path share one register handler. Shared `selectedRowClass` helper + `MAX_OCR_SUGGESTIONS = 3` constant added to remove FF cohesion duplication flagged in pre-PR review. LLM ranking explicitly deferred to a follow-up hotfix per the 2026-05-20 decision. Follow-ups: (a) `useBrands` / `useCategories` / `useMachineTemplates` now have 5 cross-feature consumers (upload, owner, admin GymMachine + admin PendingContribution + map — sub-task 4 added the fifth via `AdminPendingContributionScreen`) so the next refactor pass should move them to `src/shared/hooks/catalog/` or `src/features/catalog/hooks/` and split `mapKeys.{brands,categories,machineTemplates}` into a `catalogKeys` namespace; (b) `TemplateStep`'s client-side `brandId`/`categoryId` filter is coupled to the DTO field names, item 18's `nameKo` migration is the natural moment to push the filter into `useMachineTemplates({ brandId, categoryId })` instead.
- [x] Admin: add a queue view that lists `pending_review = true` rows, lets the admin (a) promote by mapping to an existing template, (b) create a new template plus optionally a new brand, or (c) reject. Folds into the existing admin dashboard rather than a new screen if volume stays low. → Shipped slice 4 on `task/phase-5-item-11d-admin-contribution-queue`. Backend: `GET /api/admin/contributions/pending` returns soft-delete-aware pending list (uses V6 partial index); `POST /api/admin/gym-machines/{id}/promote` with flat discriminated body `{kind, templateId?, brandId?, newBrandName?, nameEn?, nameKo?, loadingType?, categoryId?}` dispatches three paths and atomically merges into an existing approved row at the same gym when present (quantity bump + photo rebind + soft-delete pending). `DELETE /api/admin/contributions/{id}` soft-deletes. Frontend: tab inside AdminQueueScreen (신고 / 대기 머신 with counts) → `/admin/contributions/[id]` detail with three-mode promote UI + reject confirm.
- [x] Telemetry: count per-week `pending_review = true` inserts so we can falsify hypothesis H7 below. → Shipped slice 5 alongside slice 4. `ModerationAnalyticsResponse.pendingContributionsByWeek` (ISO-week histogram, includes soft-deleted rows for an honest submission-rate signal; documented post-promote undercount caveat). Weekly Slack digest gains a `대기 머신 기여 (이번 주): N건` line so ops sees H7 alongside the existing moderation metrics.
- [ ] (Optional, larger) Bulk-seed the template catalog from a public gym-equipment dataset to raise OCR hit rate before launch instead of relying entirely on user direct-input. Decide at Phase 5 kickoff based on H7 volume signal.
- [x] **Orphan upload rate limit + reaper** — Slice 2 made `POST /api/photos/upload` accept a missing `gymMachineId`, which let an authenticated user fill `<bucket>/orphan/<userId>/` with 2 MB images without ever calling `POST /api/gym-machines`. Closed by sub-task 5 (branch `task/phase-5-item-11e-orphan-reaper`, 5 slices). Vision API cost ceiling folded into the same quota — precheck runs BEFORE the Vision call so over-quota spam never spends a credit.
  - **Locked scope decisions (2026-05-22 grill-me)**: in-process COUNT precheck (not bucket4j, no Redis); rolling 1h window with HOURLY_ORPHAN_LIMIT = 10; reaper purges `machine_photos.gym_machine_id IS NULL` only (pending_review gym_machines stay admin's domain via slice 4); 24h age threshold; daily cron at 04:00 KST; row-first DELETE with NULL guard (race-safe against concurrent bind); Storage path derived from `photo_url`; log.warn + Sentry breadcrumb only on quota trip (no Slack noise); FE discriminated `uploadError` with `kind: 'quota'` hides the retry CTA.
  - **Slice (a)** — V10 partial index `idx_machine_photos_orphan_user_created ON machine_photos (user_id, created_at) WHERE gym_machine_id IS NULL`, mirrored in `init-test-db.sql` per `lesson_flyway_disabled_in_tests`. `PhotoRepository.countOrphansForUserSince` jOOQ method + `PhotoRepositoryOrphanCountIT` pinning each of the three exclusion invariants by its own named test.
  - **Slice (b)** — `PhotoService.enforceOrphanQuota` precheck fires before Vision API call when gymMachineId is null. 429 with `시간당 업로드 한도(10개)를 초과했어요. 잠시 후 다시 시도해주세요.` Bound uploads bypass the precheck. `PhotoUploadTest` +4 cases: over-quota rejects with 429 and never calls Vision/Storage, under-quota succeeds, stale orphans outside window don't count, bound uploads always reach Vision.
  - **Slice (c)** — `OrphanReaperJob` @Scheduled cron `0 0 4 * * ?` Asia/Seoul delegates to `PhotoService.purgeStaleOrphans`. DELETE-then-Storage loop with NULL-guarded DELETE — if a concurrent `POST /api/gym-machines` binds the row between SELECT and DELETE, rows-affected=0 skips the Storage file delete so the bound photo's image survives. Storage failures logged + swallowed; daily cron re-runs. `StorageService.delete(path)` + static `extractStoragePath(photoUrl)` derivation (handles bound/orphan prefixes + future signed-URL query strings + null/malformed input). `OrphanReaperJobIT` covers three guarantees: old orphan deleted + Storage called, recent orphan untouched, old bound photo untouched.
  - **Slice (d)** — `usePhotoUpload.uploadError` tightened from `Error | null` to a discriminated `UploadErrorState`. `classifyUploadError` routes `HTTPError(429)` to `{ kind: 'quota' }`, everything else to `{ kind: 'generic'; error }`. `UploadErrorView` branches on `kind` — quota renders fixed copy with NO retry button (retry against quota is a no-op until the window clears); generic keeps the existing `업로드 중 오류가 발생했어요` + retry CTA. `query-client.ts` mutation default `retry: 0` ensures the 429 surfaces immediately exactly once.
  - **Slice (e)** — this README closure (no PROGRESS.md exists for Phase 5 yet — Phase 5 is the holding pen).

**Closed-list autocomplete pattern (2026-05-20 decision)**

LLM-driven free-text brand/machine input is rejected — hallucination would create fake brands and ghost machines that look authoritative. The OCR-failure picker uses three closed-list steps backed by our own DB, plus a single escape hatch:

1. **Brand** — autocomplete over `brands` rows (5 today). Korean/English alias matching once item 18 lands.
2. **Category** — 5 fixed chips backed by `categories` rows (가슴 / 등 / 다리 / 어깨 / 팔).
3. **Template** — autocomplete over `machine_templates`, filtered by the selected brand + category. Options narrow as steps 1-2 are filled.
4. **Escape hatch** — "리스트에 없어요?" link below the template picker. Tapping reveals a free-text input that goes through the `pending_review = true` path and surfaces in the admin queue.

LLM role is constrained to ranking inside the closed list — score user-typed text against existing rows for top-3 suggestions. No free-text generation, no template synthesis. Quick Reference §8 `progressive-disclosure` + `field-grouping` apply: the 3 steps reveal sequentially as each is filled rather than dumping all selectors at once.

**Reason to defer past launch**

The decision between "let the queue grow and curate" versus "bulk-seed first" is undecidable without real submission volume. Shipping the persistence path before launch is enough to stop losing user submissions; the admin promotion UI plus bulk-seed scope answer to H7 evidence. The closed-list picker UI itself ships pre-launch alongside items 14/15 since it gates the OCR fallback that all of them depend on.

### 12. Photo upload / OCR error path needs reproduction and triage

**Current state**

Reported by the user during the same 2026-05-19 device-testing session: capturing a photo and submitting it surfaces an error rather than reaching the OCR success / fail confirm screens (`UploadConfirmScreen`'s `OcrFailView` already covers the empty-suggestion path — this error is upstream of that). Exact error text, the failing screen, and whether it is reproducible across machines plus gym types are not captured yet, and `xcrun simctl spawn booted log show ... grep ocr|photo|upload` returned no matches in the 2-minute window after the report so the error is not fresh in device logs either.

**Triage (2026-05-20)**

Reproduced statically with a new backend IT (`PhotoUploadTest.uploadAcceptsOctetStreamWithImageMagicBytes`) that builds the production RN multipart shape (image part `Content-Type: application/octet-stream`). The IT failed with `400 BAD_REQUEST` from `PhotoService.validateImage` before OCR ran, matching the user's "OcrFailView 도 못 가고 에러" report exactly.

**Root cause**: React Native's `fetch(file://...webp).then(r => r.blob())` produces a `Blob` with empty `type` on iOS (RN doesn't infer MIME from file extension). The Orval-generated `FormData.append('image', blob)` then writes a multipart part with no Content-Type header, which Spring exposes to `MultipartFile.getContentType()` as `application/octet-stream`. `PhotoService.validateImage`'s `ct.startsWith("image/")` guard rejected it before OCR. Pre-OCR image compression at frontend, not Vision API, Storage, or response-shape mismatch.

**To-do (groomed scope)**

- [x] Reproduce on the simulator with `pnpm dev:prod`: pick a gym → 사진 업로드 → capture an image → record the exact error copy plus screen and attach a Maestro-driven repro flow under `.maestro/flows/`. → Substituted with a deterministic backend IT (`uploadAcceptsOctetStreamWithImageMagicBytes`) that exercises the exact production multipart shape. Simulator/Maestro repro skipped because (a) iOS simulator has no real camera, the gallery-pick path runs identical code, and the gallery-pick path is already covered by the IT, and (b) the IT pins the contract against any future regression — Maestro would assert UI state but not the failing HTTP exchange.
- [x] Pull the failing request from device logs (`xcrun simctl spawn booted log show ... grep -iE 'photo|vision|ocr|/api/'`) plus the corresponding Render log entry, plus the Sentry event if one was emitted. → Device logs in the 30 minute window were empty (the user had not retried recently). Static trace through `usePhotoUpload.runUpload` → Orval `upload` → `PhotoService.validateImage` was sufficient given the IT reproduces deterministically.
- [x] Classify the failure: Vision API 5xx, Supabase Storage upload failure, multipart parsing, response shape mismatch, or pre-OCR image compression. → **Multipart parsing / Content-Type validation**. Fix lives in both `usePhotoUpload` (root cause) and `PhotoService.validateImage` (defense-in-depth for any client that omits the part Content-Type).
- [x] Decide whether to fail-open to `OcrFailView` (graceful degrade to the existing manual-input path) versus showing a user-actionable error toast. → Neither: the request was a valid image upload that the API incorrectly rejected. Fix is "make it succeed", not "make the failure prettier". The existing `usePhotoUpload` catch + `UploadErrorView` is retained for genuine network / 5xx failures.
- [x] Add the error path to the test suite — Photo upload IT covering the failing branch, frontend test covering the toast / fallback copy. → Backend IT `uploadAcceptsOctetStreamWithImageMagicBytes` (success path) + `uploadRejectsOctetStreamWithoutImageMagicBytes` (rejects non-image bytes even when Content-Type is missing). Frontend test `sends RN file descriptor (uri + name + type) instead of a typeless Blob` pins the hook's multipart shape so a future Orval regen or fetch+blob revert is caught.

**Resolution (2026-05-20)**

Shipped via PR on the `hotfix/phase-5-item-12-photo-upload-content-type` branch. Two-layer fix:

1. **Frontend** (`src/features/upload/hooks/usePhotoUpload.ts`): replaced `fetch(file://).blob()` with the RN file descriptor `{ uri, name: 'photo.webp', type: 'image/webp' }` passed directly to `FormData.append`. RN's native multipart writer reads these fields and emits the correct `Content-Type: image/webp` and `filename="photo.webp"` per-part headers.
2. **Backend** (`iron-spot-api/.../PhotoService.java`): when the part `Content-Type` is missing or non-`image/*`, fall back to magic-byte sniffing for JPEG / PNG / WebP / HEIC signatures. Robust against any client (curl, web, future RN behaviour shifts) that doesn't set the part Content-Type.
3. Format constants centralised in `src/features/upload/constants.ts` (UPLOAD_IMAGE_FORMAT / PHOTO_FILENAME / PHOTO_MIME_TYPE) so the compression step, multipart writer, and tests derive the format choice from one source.

### 13. NL search camera animation drops zoom on long-distance jumps, ignores resolved radius

**Current state**

Reported by the user on a physical iPhone in New Zealand: searching "강남역 헬스장" panned the map toward Seoul but the zoom level ended up zoomed way out (Seoul-wide rather than Gangnam-block). Trace of the behaviour:

- `MapScreen.tsx:32` sets `INITIAL_ZOOM = 14`. First camera anchors on the user's GPS (overseas testers see their current country, not Korea).
- `MapScreen.tsx:168` calls `mapRef.current?.animateCameraTo({ latitude, longitude, duration: CAMERA_ANIMATE_MS })` without a `zoom` argument. The omission is intentional — a comment at `MapScreen.tsx:163` warns that zoom-changing camera animations race with marker mount in `@mj-studio/react-native-naver-map` and clear newly added overlays.
- The Naver Maps SDK appears to apply a cinematic long-distance behaviour (zoom out → pan → zoom in) when the start and end points are thousands of kilometres apart, and the zoom does not return to the pre-animation level. Confirmed only by user report so far; no SDK doc citation yet.
- Backend already ships `resolvedLocation.radiusKm` in the NL response (1 km, 3 km, etc.) but the frontend only uses it to render the "1km 이내" chip — it is not threaded into the camera zoom calculation.

**To-do (groomed scope)**

- [ ] Reproduce: dev-build the simulator with `pnpm dev:prod`, set the iOS simulator location to Auckland (`xcrun simctl location booted set -36.8485,174.7633`), search "강남역 헬스장", confirm the same zoomed-out finish. Compare against starting in Seoul. → **Manual device step (outstanding).** Code work landed in `d1d95cb` (see Resolution); on-device confirmation is nice-to-have but not blocking — the bbox clamp + `planNlCamera` test cases already exercise the fix algorithmically.
- [x] Decide camera strategy. Three options to grill: (a) jump-then-animate (no-anim `setCamera` to a point near the destination then short `animateCameraTo` for the polish — bypasses the long-distance cinematic), (b) animate with explicit zoom (pass `zoom: derivedFromRadius` and accept a one-frame marker race that the existing `CAMERA_DEFER_MS` already partially mitigates), or (c) avoid animation for jumps over a threshold (e.g. > 500 km — instant snap + defer markers). → Landed in `d1d95cb` as option (c) implemented as `planNlCamera` in `src/features/map/lib/cameraUtils.ts` — long-distance jumps (>500 km) skip the cinematic by calling `setCamera` instantly then deferring marker reveal via `CAMERA_DEFER_MS`.
- [x] Thread `resolvedLocation.radiusKm` into the zoom calculation. Rough mapping: 1 km → 15, 3 km → 13, 5 km → 12 (Web Mercator approximation). Lock the curve via Naver SDK's `fitBounds` if it accepts a centre + radius, otherwise hand-roll. → Shipped via `deriveZoomFromRadius` in `cameraUtils.ts`, consumed by `planNlCamera`. Naver SDK does not expose `fitBounds` so the closed-form `15 - log2(radiusKm)` is used per the recommended solution.
- [x] Side concern: starting camera fallback when GPS resolves outside Korea. Today the first camera is the user's GPS, which means the rare overseas tester (e.g. the developer) sees their current country before the first NL search. Per the locked "Korean users only" scope decision (see end of section), we do not need to support overseas usage — the fix here is a clamp: if `initialLocation` falls outside the Korea bounding box (roughly lat 33–39, lng 124–132), fall back to a fixed Korean centre (서울시청 좌표) at zoom 14 so the first camera always lands on Korea and the subsequent NL search never has to cross a long-distance jump. → Shipped as `clampToKoreaBbox` in `cameraUtils.ts`.
- [x] Coverage: extend the existing MapScreen camera test (if present) with two cases — short-distance pan keeps zoom 14, long-distance jump lands on `derivedZoom = f(radiusKm)`. → MapScreen itself is excluded from Jest coverage (NaverMapView causes SIGABRT per `docs/harness/lessons.md`), so the camera logic was extracted into `cameraUtils.ts` and unit-tested in `cameraUtils.test.ts` covering both radius-derived zoom and the Auckland-bbox clamp.

**Recommended solution (ui-ux-pro-max review, 2026-05-20)**

Use NaverMap's `setBounds` / `fitBounds` if the SDK exposes it: centre = `resolvedLocation.coordinates`, padding derived from `radiusKm × 1.3` so all markers sit inside the visible viewport. If the SDK only accepts a zoom integer, derive it from radius via Web Mercator approximation `zoom = round(15 − log2(radiusKm))` (1 km → 15, 3 km → 13, 5 km → 12). For long-distance jumps (start↔end > 500 km), bypass the cinematic animation entirely — call `setCamera` (instant, no transition phase) so the SDK's auto zoom-out never fires, then trigger the existing marker reveal pipeline after a slightly longer `CAMERA_DEFER_MS` (~150 ms) to absorb settle time. Quick Reference §7 `layout-shift-avoid` + `interruptible` + `motion-meaning` apply: the cinematic loses meaning when the start point is in a different country; a clean instant snap reads as "search jumped" while an animated zoom-out reads as confused intent.

**Reason to ship pre-launch (re-classified 2026-05-20)**

Originally filed as a Phase 5 holding-pen item under the assumption it only hit overseas testers. That was wrong on two counts:

1. The missing zoom argument is distance-independent. Every NL search where the user-supplied radius differs from the current camera zoom produces an off-spec viewport. Domestic example: 강남에서 "성수역 2km 반경 헬스장" 검색 → 카메라는 성수역으로 이동하지만 zoom 14 유지 → 2 km 반경이 화면에 안 들어옴. The product spec ("radius is what the user asked for") is silently violated on every multi-radius query.
2. Long-distance cinematic still triggers inside Korea — 서울 ↔ 부산 ~325 km, 서울 ↔ 제주 ~450 km. Both are realistic travel scenarios for a launch cohort. The Naver SDK's exact threshold is unverified, so even shorter intra-Korea jumps may trigger it.

Treat as pre-launch hotfix: thread `radiusKm` into the zoom calculation first (closes the spec violation), then layer the long-distance `setCamera` bypass once SDK repro pins down the threshold.

**Resolution (2026-05-20)**

Shipped as `d1d95cb` on `main`. All three planned bullets landed in a single hotfix commit since the changes are tightly coupled and all live in one new pure-utility file:

| Concern               | Implementation                                                                                                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Radius → zoom mapping | `deriveZoomFromRadius` in `src/features/map/lib/cameraUtils.ts` — `floor(15 − log2(radiusKm))` clamped to [10, 17]                                                                      |
| Long-distance jumps   | `shouldBypassCinematicTransition` via haversine > 500km from GPS-anchored search origin → `setCamera` (instant) + deferred marker reveal                                                |
| Korea-only fallback   | `clampToKoreaBbox` snaps initialLocation outside Korea bbox (lat 33–39, lng 124–132) to 서울시청 default                                                                                |
| Integration           | `planNlCamera` orchestrates the three above; consumed by `MapScreen`. MapScreen excluded from Jest (NaverMapView SIGABRT per `lessons.md`); algorithm coverage in `cameraUtils.test.ts` |

### 14. Unregistered gym card tap routes the user to a duplicate search step

**Current state**

Reported by the user during the same 2026-05-20 review on a physical iPhone. The NL search bottom sheet's `UnregisteredGymCard` advertises "첫 등록자 되어 정보 추가하기" but tapping it routes to `/(upload)/gym-select?openNewGym=1&initialQuery=<name>` — the "새 헬스장 등록" screen — and the user has to **Naver-search the same name again and pick the same place** before getting to the camera. The `UnregisteredPlace` object already carries `naverPlaceId`, `name`, `address`, `latitude`, `longitude`, so the search-then-select step is pure friction.

**To-do (groomed scope)**

- [x] Frontend: replace the `router.push('/(upload)/gym-select', ...)` in `MapScreen.handleUnregisteredPress` with a direct `useCreateGym(place)` call (Naver place fed straight into the existing mutation). → Shipped earlier as part of `978bb92` (item 14 partial), landing the user on `/(upload)/gym-select?selectedGymId=<newGymId>` while `POST /api/gym-machines` was still pending.
- [x] On mutation success, route to `/(upload)/camera?gymId=<newGymId>` so the user lands on the camera with the new gym pre-bound. → Shipped this PR on `hotfix/phase-5-item-14a-route-to-camera`. Now that item 11 (POST `/api/gym-machines`) is fully wired through slices 1-3, the gym-select intermediate is pure friction and the camera (`UPLOAD_PHOTO_PATHNAME` = `/(upload)/photo`) accepts gymId-only callers since item 11 slice 2 — landing here flows directly into the OCR + closed-list picker (item 11 slice 3). Route param name is `gymId` (matches `UploadPhotoScreen.useLocalSearchParams`).
- [x] Add an "undo" toast on the camera screen for ~5 s ("○○를 등록했어요 · 취소") that rolls back the gym row if tapped. Persisted state hand-over via expo-router params, not a global store. → **Shipped.** Backend in 14a (PR #142): `DELETE /api/gyms/{id}` + V9 `created_by_user_id` column + 7-case authorisation IT. Frontend in 14b: `UndoRegistrationToast` + `useUndoRegistration` hook + camera route reads new `justRegisteredGym{Id,Name}` params; MapScreen's `useCreateGym` onSuccess threads them so the toast only mounts on the unregistered-card-tap path. Reanimated slide-in/out, amber "취소" CTA, 5s setTimeout, on-success `router.replace('/')` for clean back stack, on-error burnt toast ("등록 취소 실패"). 11 new unit/component tests (frontend lint + tsc + jest 676 ✓). Visual sim check still recommended before merge — `pnpm snap` after deep-linking to camera with the new params. **Superseded by the 23a-23f refactor below (2026-05-21).**
- [x] Telemetry: count gym-row rollbacks per week — if > 5 % we re-add a confirmation modal. → **Superseded by the atomic-create iteration below (2026-05-21).** With no rollback path the metric is 0 by construction, so no telemetry to wire.

**Iteration: atomic create on first photo, replaces the immediate-create + undo workaround (2026-05-21, slices 23a-23f)**

Triggered by a real-device session where the optimistic immediate-create flow exposed several footguns: a double-POST race when iOS's NSURLSession connection racing cancelled one of two parallel requests (mid-flight refresh from `useCreateGym` retry surfaced "등록 실패" toast on a gym row that actually committed); a 5s undo window meant orphan gyms accumulated if the user backgrounded the app; the gym row lived in the DB before the user picked even one machine. The UX recommendation in the original section (Quick Reference §8 `undo-support`) trusted the tap too literally — the tap doesn't actually mean "register this gym," it means "look at this gym and decide whether to register." The refactor below re-aligns the implementation with that intent.

New flow:

1. Tap unregistered card on the bottom sheet → opens `UnregisteredGymDetail` mode (no DB write). Place metadata + empty gallery + a single CTA "기구 사진 등록하기".
2. CTA → photo camera with the Naver place serialised on the route param.
3. Photo + OCR + machine pick → submit goes through the existing `POST /api/gym-machines`, but with the new `naverPlace` field (alternative to `gymId`). Server creates the gym row, the gym_machine row, and binds the photo all inside one `@Transactional` block.
4. On success, `router.replace('/')` returns to the map; the new gym appears on the next NL/filter search.

Backend contract: `CreateGymMachineRequest` accepts exactly one of `{ gymId, naverPlace }`; `CreateGymMachineResponse` always returns `gymId` so the client can navigate to the new gym. `GymService.createFromNaverPlaces` is idempotent on the UNIQUE `naver_place_id` index so concurrent first-registrants converge on a single gym row.

Slices (PR `task/phase-5-item-23-de-unregistered-flow` opened atop merged PR #144 which carried slices a-c):

- **23a**: backend — `CreateGymMachineRequest.naverPlace`, `MachineService.resolveGymId`, IT covering happy-path and ambiguous-input rejection (commit `a2bf5d9`, merged in #144).
- **23b**: regen OpenAPI + Orval client (`b3429b1`, merged in #144).
- **23c**: `UnregisteredGymDetail` component + `unregistered-detail` mode + `useBottomSheetMode` selection state (`bcd3459`, merged in #144).
- **23d**: thread `naverPlace` through `UploadPhotoScreen` + `UploadConfirmScreen`; submit branches on the field and lands the user on the map root on success (this PR).
- **23e**: remove the dead immediate-create scaffolding — `useCreateGym.handleCreateGymFromUnregisteredPlace`, `UndoRegistrationToast`, `useUndoRegistration`, `MapScreen.createGymInFlightRef`, `pendingUnregisteredPlaceId` plumbing (this PR).
- **23f**: this docs update (this PR).

Kept as admin/cleanup primitives even though no user-facing path drives them now: `DELETE /api/gyms/{id}` + V9 `created_by_user_id` column.

**Recommended solution (ui-ux-pro-max review, 2026-05-20)**

CTA copy already promises registration, so showing a second confirmation modal would feel like the app distrusts the user's tap. Optimistic flow + undo is the better pattern (Quick Reference §8 `undo-support`): trust the tap, fire `useCreateGym(place)` immediately with an optimistic loading state on the bottom sheet card (spinner overlay, "등록 중..."), then push to the camera screen with the new `gymId`. The camera screen shows a 5-second dismissible "○○를 등록했어요 · 취소" toast at the top; tapping 취소 fires a delete mutation against the gym row plus pops back to map. Quick Reference §4 `primary-action` + §9 `back-stack-integrity` apply: the bottom-sheet card is the screen's only primary CTA, and the back stack stays clean (map → camera, not map → search → select → camera).

**Reason to ship pre-launch**

Current UX violates the CTA copy — the screen labels the action "register me as the first contributor" but actually requires the user to do the same task twice. Fixing this before launch is cheaper than apologising in App Store reviews. Pre-launch hotfix branch, not Phase 5 holding pen.

### 15. Gym detail has no entry point to register a new machine

**Current state**

`GymDetail` → `MachineList` only renders the gym's already-registered `gym_machines`. Each card taps into `MachinePhotoGalleryScreen` which only allows adding photos to that existing machine. A user who walks into a gym and notices a brand-new piece of equipment (not yet in our DB) has no way to add a photo of it from inside the gym detail — they would have to back out, go to upload, choose the gym again, and start over. Independently, `MachinePhotoGalleryScreen.handlePressUpload` pushes to `/(upload)/gym-select` without the current `gymId`, forcing the user to re-pick the gym they are already inside of.

**To-do (groomed scope)**

- [x] Add a Material FAB ("+", label "사진 추가") floating bottom-right in `GymDetail`, above `MachineList`. → Shipped earlier as a placeholder; this PR completes the wire-up.
- [x] FAB tap routes to `/(upload)/photo?gymId=<id>` with no machine pre-selected; the camera screen runs OCR, matches against `machine_templates`, and either re-uses an existing `gym_machines` row for this gym or creates a new one bound to the matched template. → Shipped via PR #137 on `hotfix/phase-5-item-15-gym-detail-fab` (route name is `/(upload)/photo`, not `/(upload)/camera` as originally drafted — actual `app/(upload)/photo.tsx` was the existing route). `AddPhotoFab.handlePress` now pushes `{ pathname: UPLOAD_PHOTO_PATHNAME, params: { gymId } }`; OCR + template-match path lives in `UploadConfirmScreen` and was already wired by item 11 slice 2 (#136).
- [x] OCR no-match path folds into item 11's direct-input persistence (carry `gymId` so the orphaned-photo bug item 11 fixes does not regress here). → Inherited from item 11 slice 2: when `templateId` is null on the confirm screen, `useCreateGymMachine` posts `{ gymId, freeFormName }` with `pending_review = true`, and the orphan photo (no `gymMachineId`) is bound via `PhotoRepository.bindOrphanGymMachineId` inside the same request. No new code required from item 15.
- [x] Fix `MachinePhotoGalleryScreen.handlePressUpload` to push `/(upload)/photo?gymId=<id>&gymMachineId=<machineId>` so the camera lands pre-bound to both gym + machine. → Shipped in PR #137 (param name is `gymMachineId`, matching `UploadPhotoScreen.useLocalSearchParams`, not `prefMachineId` as originally drafted). Guard tightened to `if (!gymId || !machineId) return;` so the function's gym+machine pair semantics are enforced symmetrically.
- [x] Test coverage: `GymDetail` renders FAB above `MachineList`; FAB tap calls `router.push` with the gym ID; `MachinePhotoGalleryScreen.handlePressUpload` carries gymId. → All three covered. Bonus: symmetric "skip when gymId undefined" regression-pin added on the gallery FAB. Pre-PR FF review (🔴 cohesion / 🟡 predictability) also produced an `UPLOAD_PHOTO_PATHNAME` constant shared by all three callers + test assertions (slice 3).

**Recommended solution (ui-ux-pro-max review, 2026-05-20)**

A Material FAB is the right pattern here — both iOS HIG and Material Design treat FAB as the "primary action of this screen" anchor, and it sits above scroll content without competing with the machine cards. Quick Reference §4 `primary-action` (one primary CTA per screen) + §9 `nav-hierarchy` apply: machine-card taps stay secondary (go into existing machine gallery), FAB stays primary (add new). Secondary actions like "신고하기" stay inside each `MachineCard` as before. Avoid a sticky bottom bar with two CTAs — it steals vertical space and weakens the primary action visually.

**Reason to ship pre-launch**

This is the app's core value loop: gym → "I see a new machine" → photo → contribution. Without an entry point the loop never starts and the gym's data stays stale. Pre-launch hotfix branch.

### 16. No directions affordance — NL search dead-ends at the gym detail

**Current state**

The NL search funnel ends at the gym card or detail screen — there is no way to actually navigate to the gym. Users have to copy the address, switch to Naver Maps, paste, and start a route. This breaks the "search → go there" flow that any map-search product is expected to close. `gyms.naver_place_id` is already persisted in prod (the F7 Naver merge guarantees it for registered gyms), and the Korean default routing app is Naver Maps, so a deep link path is short.

**To-do (groomed scope)**

- [x] Add a "길찾기" chip on `GymCard` (bottom sheet, next to the address line) and a header-right "길찾기" button on `GymDetail`. Both wired to a shared `openDirections(gym)` handler. → Slice 16b. `DirectionsChip` component shared between both surfaces.
- [x] Handler: `Linking.canOpenURL('nmap://')` → if true and `naver_place_id` exists, open `nmap://place?id=<id>&appname=com.ironspot.app`; if true with no place id, open `nmap://route/public?slat=<userLat>&slng=<userLng>&dlat=<gymLat>&dlng=<gymLng>&dname=<encodedName>&appname=...`; if false, fall back to `https://map.naver.com/v5/search/<encoded>` via WebBrowser. → Slice 16a. Lives at `src/shared/lib/directions.ts` with 12 unit tests covering both deeplink branches, the empty-place-id edge case, the WebBrowser fallback, and `canOpenURL`-rejection-as-absent. **Caveat**: card + detail pass `naverPlaceId: null` because the gym DTOs don't yet surface the column — the lib falls through to the lat/lng route deeplink. Surface the field once the conversion metric warrants the place-card UX upgrade.
- [x] Origin policy: default to current GPS. When the NL response carried a `resolvedLocation` reference point (e.g. "강남역"), surface a one-time ActionSheet "현재 위치 / 강남역에서" on first tap of the session and remember the choice. Skip the sheet for "내 주변" / no-reference searches. → Slice 16c. `DirectionsOriginProvider` + `useDirectionsOriginResolver` hook + `@expo/react-native-action-sheet`. Session boundary is the NL `resolvedLocation.coordinates` pair (Q1). Current ActionSheet copy uses generic "검색 위치에서" because the ResolvedLocation DTO doesn't expose a name field; a backend follow-up can surface "강남역에서" labelling.
- [x] Native config: add `LSApplicationQueriesSchemes: ["nmap"]` to `app.config.ts` under `ios.infoPlist`. **Native rebuild required** — batch with other native changes if any. → Slice 16a (added under `ios.infoPlist` in `app.json`).
- [x] Telemetry: count taps per session to validate the affordance is being discovered. If <10 % conversion from gym detail to directions tap after 4 weeks, move the entry point to a more visible slot. → Slices 16a + 16b. Sentry breadcrumb (`category: 'directions'`, `data: { gymId, source: 'card'|'detail', branch: 'place'|'route' }`) drops on every chip tap. Conversion measurement = aggregate breadcrumb count per session in Sentry.

**Pre-implementation grilling (2026-05-21)**

Locked via `/grill-me`:

- **Q1**: ActionSheet remembered per NL search session (not app-lifetime, not per-tap). New NL search clears the cache.
- **Q2**: ADR deeplink branching preserved (place id → `nmap://place`, else `nmap://route/public`).
- **Q3**: Web fallback via `expo-web-browser` (in-app), not the system browser — keeps the IronSpot session.
- **Q4**: Sentry breadcrumb for telemetry; defer Mixpanel/Amplitude until the conversion data shows the affordance is moving.
- **Q5**: 4 slices (16a lib + native + tests / 16b UI + Sentry / 16c ActionSheet / 16d docs).
- **Q5b**: `@expo/react-native-action-sheet` (iOS/Android unified API).

**Recommended solution (ui-ux-pro-max review, 2026-05-20)**

Two entry points, both secondary. The bottom-sheet `GymCard` chip is the one-tap path for the most common case (user has shortlisted from search, hasn't entered detail). The header-right `GymDetail` button is for users who entered detail first to check photos / equipment. Both buttons are visually subordinate to the screen's primary CTA (item 15 FAB on detail, gym selection on bottom sheet) — Quick Reference §4 `primary-action` keeps the hierarchy. The dual-origin ActionSheet would create noise if shown on every search, so gate it on the NL `resolvedLocation` reference point existing (typically "X역" / "X대학교" / "X구"). For "내 주변" or no-reference, current GPS is always right. Quick Reference §9 `escape-routes` + §8 `error-recovery` cover the web-fallback chain.

**Reason this sits in Phase 5**

Requires a native rebuild for `LSApplicationQueriesSchemes`, so it cannot land via OTA. Bundle with the next native change to amortise the rebuild cost. Not a launch blocker — manual "copy address, paste in Naver Maps" is annoying but tolerable for the first cohort, and gives us H4-like volume signal on whether this affordance is even valued.

### 17. Gym cover photo — owner-only upload, placeholder otherwise

**Current state**

Bottom-sheet `GymCard` already accepts a `thumbnailUrl` prop (`src/features/gym/components/GymCard.tsx:17`) but nothing threads a real value into it — every card renders the placeholder. The user asked whether we could pull the cover image Naver shows on its own search results (e.g. the red 짐박스 톡톡 image visible in the 2026-05-20 review screenshot). Audit findings:

- Naver Local Search API response has no image field (`title, link, category, telephone, address, roadAddress, mapx, mapy` only).
- No public Naver API exposes Place cover photos; `map.naver.com` HTML scraping violates Naver's terms and robots.txt.
- Naver Image Search API can be queried by gym name but matches are unreliable (same-name different branches, unrelated blog images) and the results carry third-party copyright. App Store guidelines 5.2.2 / 5.2.3 reject apps that surface third-party content without explicit consent.

**Locked decision (2026-05-20)**

- Only gym owners (the Task 47 owner-verification path) can upload the cover photo for their gym.
- Photos uploaded by regular users through the normal contribution flow stay machine-bound — they never get promoted to the gym's cover.
- When no owner has uploaded yet, the bottom-sheet card keeps the placeholder. No automatic fallback to user-submitted photos, Naver search, or image-search APIs.

**To-do (groomed scope)**

- [x] DB: add `gyms.cover_photo_url TEXT NULL` via a new Flyway migration. → V15 in `#167`.
- [x] Backend: extend `GymResponse` / NL search response to surface `coverPhotoUrl`. → `GymWithMachineCountResponse.coverPhotoUrl` + repository SELECTs in `#172`; `GymDetailResponse.coverPhotoUrl` added in `#173` slice (e) so the owner cover screen can read current state.
- [x] Owner upload screen: in the Task 47 "내 매장 관리하기" surface, add a "대표 사진" section — upload, preview, remove. Reuse the existing photo upload pipeline (Vision SafeSearch + PII check) but skip the OCR + machine-binding steps. → `#173` (5 slices: gate refactor + DTO + controller/service/IT + Orval regen + FE screen + entry chip).
- [x] Frontend: thread `coverPhotoUrl` through `useMapSearch`, `useNlSearch`, and gym detail into `GymCard`'s existing `thumbnailUrl` prop. Placeholder stays when null. → `#172` FE wiring (toGymWithMachineCount → GymBottomSheet → GymCard.thumbnailUrl). Gym detail bonus: hero render in `#175`.
- [x] Test coverage: backend IT for owner-only upload (403 for non-owner), frontend test that `GymCard` renders the placeholder when `thumbnailUrl` is null and the image when set. → 8-case `OwnerCoverPhotoIT` in `#173`; `GymCard` placeholder vs Image RTL cases in `#172`.

**Recommended solution (ui-ux-pro-max review, 2026-05-20)**

Owner-only upload keeps every cover photo accountable to a verified business identity, sidesteps the third-party copyright problem entirely, and gives Task 47 owners a tangible reward for completing verification (their photo, not anonymous user-submitted content, represents their gym). Quick Reference §4 `style-match` (cover photo is a brand expression, belongs to whoever owns the brand) and §1 `color-not-only` apply: when no cover is set the placeholder must still convey hierarchy via the gym name + distance metadata, not visually collapse to "broken card". Keep the placeholder neutral and consistent across cards so the visual rhythm of the bottom sheet stays stable as cover photos populate gradually.

**Reason this sits in Phase 5**

Depends on Task 47 owner workflow being merged + a measurable number of owners having gone through verification. Pre-launch there are zero verified owners so the feature would have no real data. Ships when owner verification volume hits double digits — until then the placeholder is the right state.

**Resolution (2026-05-24)**

Shipped end-to-end across four PRs targeting `main`. Original to-do scope plus the deferred GymDetail hero design pass.

| PR     | Scope                                                                                                                                                                                                                                                                                                     |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `#167` | V15 migration: `gyms.cover_photo_url TEXT NULL` + init-test-db mirror. BE wiring + FE deferred to follow-up PRs.                                                                                                                                                                                          |
| `#172` | FE wiring: `toGymWithMachineCount` maps `coverPhotoUrl ?? null` → `cover_photo_url`; `GymBottomSheet` threads to `GymCard.thumbnailUrl`. 9 fixtures + `GymCard` placeholder/Image RTL cases.                                                                                                              |
| `#173` | 5 slices: `PhotoService.runVisionPiiGate` extraction + `GymCoverPhotoResponse` DTO + `OwnerCoverPhotoController`/`Service` + Orval regen + FE `OwnerCoverPhotoScreen` + "대표" entry chip. 8-case `OwnerCoverPhotoIT`. Adds `GymDetailResponse.coverPhotoUrl` so the owner screen can read current state. |
| `#175` | Bonus follow-up: `GymDetail` hero (16:9 edge-to-edge, conditional on `cover_photo_url`, `expo-image` with fade-in transition, `onError` collapse). 2 new RTL cases. Beyond the original to-do — closes the deferred "GymDetail design pass" from the cover-photo follow-ups memo.                         |

Design locks recorded in PR bodies (Storage layout `gym-covers/{gymId}/{uuid}.webp` in shared `machine-photos` bucket; SafeSearch QUEUE_FOR_ADMIN rejected stricter than machine photos; idempotent DELETE; per-user Vision quota counted; 2MB cap + magic-byte validation; FE crop via `expo-image-picker` `allowsEditing: true, aspect: [16, 9]` + `expo-image-manipulator` resize 1280×720 WebP 0.8).

Open follow-ups (deferred polish, see `project_phase_5_followups` memory): hero title overlay (Airbnb / Naver Place scrim), parallax / shrink-on-scroll, lightbox tap, blurhash loading preview, dedicated reaper for `gym-covers/` Storage leaks.

### 18. Korean-first labelling for brands and machine templates

**Current state**

`brands` and `machine_templates` ship one English `name` column today. The launch cohort reads Korean, and while gym-goers recognise brand names in English (`Hammer Strength`, `Life Fitness`, `Technogym`, `Panatta`, `Hoist`), machine names compound across two English words (`Panatta Chest Press`, `Hammer Strength Lat Pull Down`) which slows card scanning and breaks NL search input — a user who types `해머스트렝스 풀다운` gets no match because `FuzzyMatchService` Jaccard-tokenises only `name_en`.

**Locked decision (2026-05-20) — Option C**

- **Brand**: English name retained. Domestic gym-goers already recognise the latin form; machine-body labels are also in English, so keeping brands in English preserves the 1:1 mapping between our card and the physical equipment the user is standing in front of.
- **Machine template**: Korean primary, English secondary.
  - Bottom sheet / list cards: render Korean only (e.g. `Panatta 체스트 프레스`).
  - Machine detail screen: Korean primary line + English smaller secondary line below (`Panatta Chest Press`).
- **Category**: already Korean-mapped via the filter sheet's "운동 부위" labels. No work.
- **Search matching**: `FuzzyMatchService` tokenises both `name_ko` and `name_en` so both `해머스트렝스 풀다운` and `Hammer Strength Lat Pull Down` match the same row.

**Scope refinement (2026-05-20)**

Original to-do bullets covered both schema + code (item 18 proper) and the data work of hand-backfilling Korean names for the 11 prod template rows. User feedback (2026-05-20) re-scoped this: pre-launch data is all temporary and gets wiped, the curated catalog (plate-load / pin-load brands across US / Italy / Korea) is broader than 11 templates, and the data step deserves its own iteration with web research. Item 18 here ships **code only**; item 22 below carries the catalog bulk-seed.

**To-do (groomed scope)**

- [x] DB: V7 migration renames `machine_templates.name` → `name_en`, adds `name_ko TEXT NOT NULL`. Wipe-first (DELETE chain through reports → machine_photos → gym_machines → machine_templates) so NOT NULL applies against an empty table — pre-launch data is dev/smoke only, user OK'd the cascading wipe + Storage orphans. → Shipped slice (a) in `b529c2a`.
- [x] Backend: `MachineTemplateSummary` carries both `nameEn` + `nameKo`. `MachineTemplateResponse` + `MachineTemplateSuggestion` DTOs split `name` → `nameEn` + add `nameKo`. `GymMachineResponse` symmetrically splits `machineName` → `machineNameEn` + `machineNameKo` so per-gym instance surfaces also surface Korean. → Slices (a) + (b) + (c).
- [x] `FuzzyMatchService.findMatches` (OCR path) concatenates `brandName + nameEn + nameKo` into one token set so OCR text in either language matches the same row. `findTemplateIds` (NL search path) scores English and Korean columns independently and takes `max(en, ko)` so unrelated tokens in the off-language column don't dilute precision. → Slice (b) in `e77e636`.
- [x] OpenAPI + Orval regen: TypeScript client picks up `nameEn` / `nameKo` on both DTOs + `machineNameEn` / `machineNameKo` on `GymMachineResponse` + the new `brandId` / `categoryId` query params on `GET /api/machine-templates`. → Slices (b) + (c).
- [x] Frontend: `MachineList` rows render Korean primary via `machineDisplayName()`. `MachinePhotoGalleryScreen` header renders Korean primary heading + smaller English secondary line. `MachinePicker` TemplateStep renders Korean primary in each row and search matches across `brandName + nameKo + nameEn`. `FilterSheet`'s active-filter chip uses Korean (e.g. "Panatta 하이로우 · 핀"). `GymCard` was no-op (item 19 already removed machine name list before item 18 landed). Admin / Owner surfaces prefer Korean too (`nameKo ?? nameEn`). → Slice (c) in `52485bf`.
- [x] MachinePicker slice-3 follow-up: TemplateStep's in-JS `.filter(t => t.brandId === brandId && t.categoryId === categoryId)` swapped for `useMachineTemplates({ brandId, categoryId })` server pushdown. Hook only fetches once both axes are picked; queryKey embeds the tuple so `staleTime: Infinity` per-combination keeps re-visits hot. → Slice (c).
- [x] NL search prompt: `search-dsl.md` gains a `근처 해머스트렝스 풀다운 머신 있는 곳` → `Hammer Strength Lat Pull Down` few-shot. `queries.yaml` gains a matching 7th eval case (~17.5K TPD, ~18% of Groq free-tier daily budget). → Slice (e) in `95dd482`.
- [x] Test coverage: `FuzzyMatchServiceTest` +3 cases (Korean alias `랫 풀다운` → English row, English `Chest Press` → Korean primary row, OCR bilingual concat). `MachineTemplateControllerTest` +3 cases (brandId narrow, categoryId narrow, both AND). `MachinePicker.test.tsx` mocks `useMachineTemplates` to respect the params arg so the "only matching rows render" assertions survive the JS-filter removal. Frontend factories + 12 fixture files updated to carry both name variants. → Across all slices.

**Out of slice (deferred / non-regression)**

- **Interpretation chip (`InterpretationChip`) Korean rendering**: the chip displays `text` formatted server-side by `InterpretationFormatter` from the canonical-English DSL. Surfacing Korean here requires the formatter to look up `nameKo` by `templateId` (an extra catalog read or a denormalised join). The chip stayed English before item 18 — no regression — and the bigger surfaces (cards, picker, detail) now read Korean, so this minor surface defers to a follow-up. Folds into item 22 timing or whichever NL-polish item comes next.
- **Korean morpheme tokenisation**: current `tokenize` splits on whitespace. A user typing "해머스트렝스랫풀다운" without spaces wouldn't match. Out of scope here; the picker's free-form escape hatch + admin queue path absorbs such inputs via `pending_review = true`.

**Recommended solution (ui-ux-pro-max review, 2026-05-20)**

Option C is the right balance for the launch cohort. Brands stay English because gym-goers recognise them that way and machine bodies are labelled in English, so the card matches the physical world. Machine names compound poorly in English for native Korean speakers ("Panatta Chest Press" reads slower than "Panatta 체스트 프레스"), so Korean primary speeds card scanning. The English secondary line on detail preserves the precise reference for users who want to look up the exact model. Quick Reference §6 `text-styles-system` (clear hierarchy via weight/size between primary and secondary), §6 `letter-spacing` (respect Korean character spacing defaults), and §1 `dynamic-type` (both lines must survive system text scaling) apply.

**Reason to ship pre-launch**

NL search input today silently fails on Korean machine-name aliases — a domestic user typing 해머스트렝스 풀다운 gets zero results even though the gym has it. That's a core-flow regression for the launch cohort. With code-only scope (item 22 carries the data), the patch is contained and ships ahead of catalog curation timing.

**Resolution (2026-05-20)**

Shipped on `hotfix/phase-5-item-18-korean-labelling`. Six commits, all backend-and-frontend self-contained:

| Slice | Commit    | Scope                                                                                                                                                                                   |
| ----- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (a)   | `b529c2a` | V7 migration (wipe + rename + add `name_ko NOT NULL`), JOOQ regen, `MachineTemplateSummary` + Repository + FuzzyMatch callsite rename.                                                  |
| (b)   | `e77e636` | `MachineTemplateResponse` + `Suggestion` DTOs split, `FuzzyMatchService` bilingual scoring, `MachineTemplateController` brandId/categoryId query params, IT coverage.                   |
| (c)   | `52485bf` | Orval regen + every FE consumer (MachineList, Picker pushdown, Gallery dual-line header, admin/owner surfaces) + 12 fixture files. `GymMachineResponse` machineName split bundled here. |
| (e)   | `95dd482` | NL prompt few-shot + eval suite 7th case for Korean alias.                                                                                                                              |
| (f)   | this PR   | README scope refinement + item 22 new section.                                                                                                                                          |

### 19. GymCard tidy-up — drop machine list, drop category chips, clarify count copy

**Current state**

The bottom-sheet `GymCard` today crowds in (a) every machine name as a comma-separated list ("✓ Panatta Chest Press, Panatta High Row, Panatta Lat Pull Down…"), making each card 4+ lines tall, and (b) labels the count "기구 N대" which a user could reasonably read as "this gym has N machines total" rather than "N machines are currently registered in our app". Both reduce the bottom sheet's density and create wrong mental models.

**Locked decision (2026-05-20)**

- Remove the machine name list from `GymCard`. Users who want machine detail tap into `GymDetail`.
- Remove the category chip experiment that was floated in the original ui-ux-pro-max review (chips would re-introduce density we are trying to cut).
- Change the count copy to "등록된 기구 N대" — explicit about the count being our registered set, not the gym's total.
- When `machineCount === 0`, render "아직 등록된 기구가 없어요" instead of "등록된 기구 0대". The 0대 phrasing is grammatically correct but reads coldly; the alternative is friendlier and invites contribution.

**Resulting layout**

```
┌──────────────────────────────────────┐
│ 🏋  스트렝스 짐                       │
│    📍 0.5km                           │
│    등록된 기구 4대                     │
│                  확인일 2026.03.10    │
└──────────────────────────────────────┘
```

**To-do (groomed scope)**

- [x] Frontend: drop the machine-name list from `GymCard.tsx`. Replace with the single `등록된 기구 N대` line; render `아직 등록된 기구가 없어요` when N=0. → Shipped in `978bb92` (items 14+15+19 bundle); `formatMachineCount` + `EMPTY_COUNT_COPY` constants live next to `GymCard`.
- [x] Test coverage: update existing `GymCard.test.tsx` snapshots / assertions to match the new layout; add a case for the `N=0` copy. → Shipped alongside the component change in `978bb92`.
- [x] Side fix: confirm the same simplification is consistent across NL-search-result cards and filter-result cards (both render through `GymCard`). → Single `GymCard` component is shared; both paths benefit from the same fix.

**Recommended solution (ui-ux-pro-max review, 2026-05-20)**

Stripping the machine list back to a count is the right call. Quick Reference §5 `visual-hierarchy` + §5 `content-priority` apply: the bottom sheet's job is "show me which gyms exist nearby"; "which machines does each one have" is the next click, not the first scan. The count copy fix also moves the card from "this gym has N machines" to "we know about N of this gym's machines" — that subtle reframe primes the contribution loop (item 11/15 ask the user to extend that count) and prevents the wrong assumption when the count is small.

**Reason to ship pre-launch**

Goes in with items 14/15 since they all touch `GymCard` and gym-detail wiring. Decoupling them creates merge churn on the same files.

### 20. Empty bottom sheet 카피가 "필터 탓"으로만 읽힘 — 필터 비활성 분기 필요

**Current state**

`GymBottomSheet`의 `ListMode`에서 `mode.gyms.length === 0` 이면 `nlEmpty` 가 있을 때만 NL 분기를 타고, 그 외에는 무조건 동일 카피를 노출한다:

```
조건에 맞는 헬스장이 없어요
필터를 조정해보세요
[필터 초기화]
```

문제는 viewport 검색이 자동으로 한 번 도는 첫 페인트 시점이다. 사용자가 필터를 켠 적이 없는데도 결과가 0개면 같은 카피가 뜨고, "필터를 조정해보세요" 와 "필터 초기화" 버튼이 같이 노출돼 사용자는 "내가 필터를 잘못 켰나?" 라고 오해한다. 실제로는 (a) 우리 DB에 그 viewport 안에 등록된 헬스장이 없거나, (b) 사용자 GPS 위치 주변에 아직 데이터가 적은 상태일 뿐이다. Launch 직후 cohort 의 대부분이 이 상태를 자주 만난다 — seed 가 강남/홍대 중심이라 신림동·금천구·외곽 거주자는 첫 화면에서 바로 이 misleading 카피를 본다.

**Locked decision (2026-05-20)**

- `mode.type === 'list'` 에 optional 필드 `hasActiveFilters?: boolean` 추가 (default `false`). NL 모드 (`nlEmpty` 존재) 와 동일한 분기 패턴으로 GymBottomSheet 가 직접 분기. optional 이지만 MapScreen 호출처는 항상 명시적으로 전달한다. default `false` 가 안전한 fallback (= 새 카피 노출) 이라 누락돼도 misleading 카피로 회귀하지 않는다.
- 필터 비활성 (`hasActiveFilters === false`) + 결과 0개:
  ```
  이 주변엔 아직 등록된 헬스장이 없어요
  지도를 옮기거나 검색해보세요
  ```
  버튼 없음.
- 필터 활성 (`hasActiveFilters === true`) + 결과 0개: 기존 카피 + `[필터 초기화]` 그대로 유지.
- 백엔드 변경 없음. 글로벌 "DB 전체에 헬스장 N개" 카운트 API 도입은 풀 사이즈 옵션이었지만 launch 직후 어차피 0~소수 이므로 보류 — H7 (item 11) 신호가 모인 뒤 재검토.

**To-do (groomed scope)**

- [x] `src/features/gym/types.ts`: `GymBottomSheetMode` list variant 에 `hasActiveFilters?: boolean` optional 필드 추가. → Shipped in `b6a145c` (items 20+21 bundle).
- [x] `src/features/map/hooks/useBottomSheetMode.ts`: `hasActiveFilters` 를 파라미터로 받아서 list mode 에 그대로 매핑. → `b6a145c`.
- [x] `src/features/map/components/MapScreen.tsx`: 기존 `activeFilterCount` 계산을 `hasActiveFilters = activeFilterCount > 0` 로 파생해 훅에 주입. → `b6a145c`.
- [x] `src/features/gym/components/GymBottomSheet.tsx` `ListMode`: `nlEmpty` 분기 다음에 `hasActiveFilters === false` 분기 추가. NL 모드는 그대로 우선. → `b6a145c`, three-way branch lives in `renderEmptyState` (NL → hasActiveFilters → default).
- [x] 테스트: `GymBottomSheet.test.tsx` — 새 카피 + 버튼 비노출 케이스 2개 추가, 기존 "필터 활성 + 결과 0개" 케이스는 `hasActiveFilters: true` 로 명시. `useBottomSheetMode.test.ts` — `hasActiveFilters` 패스스루 케이스 1개 추가. → `b6a145c`.
- [x] Korean natural language 준수 (memory `feedback_korean_natural_language`): "아직" 어휘는 contribution 유도 + 데이터 보완 중임을 정직하게 알리는 톤. 영문 템플릿 직역 금지. → Locked copy "이 주변엔 아직 등록된 헬스장이 없어요 / 지도를 옮기거나 검색해보세요" shipped as-spec.

**Recommended solution (2026-05-20 grill-me)**

Empty state 카피는 사실관계 + 다음 행동 안내 두 줄로 구성한다. 첫 줄은 "이 주변엔 아직 등록된 헬스장이 없어요" 처럼 viewport 한정임을 분명히 하고 (전체 앱 데이터가 없다는 오해 차단), 두 번째 줄은 "지도를 옮기거나 검색해보세요" 로 사용자의 두 가지 다음 행동 (지도 panning + NL search) 모두 직접 가리킨다. CTA 버튼은 일부러 빼는데, 사용자가 이미 지도와 검색바를 보고 있어서 추가 버튼은 시각 노이즈가 되고, 필터 비활성 상태에선 "필터 초기화" 가 의미 없는 행동이라서다. 필터 활성 케이스의 기존 카피와 버튼은 정확하므로 손대지 않는다.

Quick Reference §1 `clear-language` (오해 가능한 문구 제거), §4 `primary-action` (이 화면의 1차 행동은 지도/검색이지 empty state CTA 아님), §8 `error-recovery` (empty 도 회복 가능한 상태로 안내) 적용.

**Reason to ship pre-launch**

오해를 부르는 카피가 launch 직후 가장 자주 노출되는 화면 중 하나다. 첫 인상에서 "이 앱은 필터를 켰을 때만 결과가 안 나오나 보다" 라는 잘못된 mental model 을 만들면 사용자는 (a) 필터를 안 켜고도 결과가 없는 경우를 우리 데이터 빈약 탓이 아니라 자기 조작 탓으로 돌리거나, (b) 곧장 이탈한다. App Store 리뷰가 쌓이기 전에 막을 가치가 있다. Item 13 (NL 카메라) 과 file 충돌이 없어 별도 hotfix branch 로 진행한다.

### 21. BottomSheet 정렬 — 등록 헬스장이 미등록 뒤로 밀려 first impression 손상

**Current state**

`GymBottomSheet.buildSortedList` (`src/features/gym/components/GymBottomSheet.tsx:114-131`) 가 등록 헬스장 (`mode.gyms`) 과 미등록 Naver place (`mode.unregisteredPlaces`) 를 거리 한 가지 기준으로만 정렬한다:

```ts
return [...gymItems, ...placeItems].sort((a, b) => a.distanceKm - b.distanceKm);
```

2026-05-20 simulator 검증 시나리오: prod Render 에 등록 헬스장 1곳 (강남역 ~0.3km), Naver merge 결과 미등록 3곳 (0.1km / 0.2km / 0.2km). BottomSheet 25% snap 으로 보이는 위 3개 카드가 모두 미등록 → 사용자는 "이 앱은 강남역의 등록된 헬스장을 모르네" 잘못된 결론. 끝까지 스크롤해야 등록 카드가 나옴.

지도 마커는 등록(사각형 + 머신 수) 과 미등록(원형 + "+") 시각적으로 명확히 구분되지만, BottomSheet 카드 정렬은 그 시각 신호와 어긋난다 — 마커는 보이는데 카드는 찾기 어려운 미스매치.

**Locked decision (2026-05-20) — 옵션 A (등록 우선, 그 안에서 거리)**

- 1차 키: `kind === 'gym'` (등록) 먼저, `kind === 'unregistered'` (미등록) 뒤.
- 2차 키: 거리 (가까운 순) — 1차 키 동률 안에서만 적용.
- 미등록은 등록 0개 viewport 일 때 contribution 유도용으로 노출되고, 등록이 1개라도 있으면 그 뒤로 밀린다.

이 정책의 long-term 동작: 데이터가 풍부해져 Naver merge 가 매칭에서 제외하는 곳이 늘면 미등록 카드 자체가 거의 안 나옴 → 1차 키가 자동으로 무력화 → **단순 거리 정렬과 자연스럽게 수렴**. 즉 launch 초기 보호장치이며 시간이 흐를수록 fade out.

후보 옵션 B (섹션 분리 헤더), C (정렬 그대로 + 카운터/톤 차이) 는 launch 데이터 신호 모인 뒤 재평가. 지금은 코드 변경 최소 + product 시그널 명확한 A 채택.

**To-do (groomed scope)**

- [x] `src/features/gym/components/GymBottomSheet.tsx` `buildSortedList`: 2단 비교자 적용. `(a.kind === 'gym' ? 0 : 1) - (b.kind === 'gym' ? 0 : 1) || a.distanceKm - b.distanceKm`. → Shipped in `b6a145c` as `buildBottomSheetList` in the extracted `src/features/gym/lib/sort-bottom-sheet-list.ts` (FF cohesion split out of the component). Uses a `KIND_RANK: Record<BottomSheetListItem['kind'], number>` so a third `kind` variant would force a TypeScript error.
- [x] 테스트: `GymBottomSheet.test.tsx` — (a) 가까운 미등록 + 먼 등록 → 등록 먼저, (b) 등록만 → 거리 정렬, (c) 미등록만 → 거리 정렬, (d) 동거리 혼합 → 등록 먼저. → Test moved into `src/features/gym/lib/__tests__/sort-bottom-sheet-list.test.ts` (purer unit-test home).
- [x] Item 20 와 같은 PR 에 묶음. 두 변경 모두 BottomSheet list mode 동작 + 같은 파일 라인 근접. → Bundled in `b6a145c`.
- [x] 코드 코멘트: 거리 기대 위반(먼 등록이 가까운 미등록 앞에) 의 trade-off 를 명시. launch 초기 정책임을 future 독자에게 알림. → Comment lives at the top of `buildBottomSheetList` in `sort-bottom-sheet-list.ts`.

**Recommended solution (2026-05-20 grill-me)**

옵션 A 가 launch timing 에 가장 강력하다. 등록 수가 극단적으로 적은 launch 직후엔 등록을 무조건 위로 노출해 "우리가 아는 헬스장이 있긴 있다" 시그널을 보호하고, 데이터가 풍부해진 뒤엔 1차 키가 자동으로 무력화돼 거리 정렬로 수렴하므로 future migration 비용 0. 옵션 B (섹션 분리) 는 BottomSheet 25% snap 의 카드 공간을 헤더가 차지해 시각 비용이 크고, 옵션 C (톤 차이) 는 정렬 정책 자체는 안 바꾸므로 본질 문제를 보조 신호로만 가림. Quick Reference §5 `content-priority` (등록이 product 의 1차 자원), §1 `clear-language` (미등록을 등록과 시각적으로 동등하게 두지 않기) 적용.

**Reason to ship pre-launch**

launch 직후 등록 헬스장이 viewport 안에 있어도 미등록이 더 가까우면 list 의 first impression 을 미등록이 차지함. 사용자는 "이 앱은 비어 있다" 결론을 내리고 이탈 가능성 ↑. Item 20 (empty-state 카피) 와 같은 BottomSheet list mode 의 사용자 신뢰성 문제군이라 같은 hotfix branch / 같은 PR 에서 묶어 처리한다.

### 22. Plate-load / pin-load machine catalog bulk-seed

**Current state**

Item 18 shipped the schema + code for bilingual machine templates but deliberately left `machine_templates` empty (V7 wiped the prod table since every pre-launch row was temporary dev/smoke data per user decision 2026-05-20). The picker, OCR fuzzy match, and NL search filter pushdown all work, but with an empty catalog they have nothing to match against — meaning a user who taps "사진 추가" lands on the picker and sees no brand options at all. The closed-list path is empty until item 22 lands.

**Locked decision (2026-05-20)**

- **Brand scope**: US + Italy + Korea brands only. Concretely: Hammer Strength, Life Fitness, Technogym, Panatta, Hoist, Cybex, Matrix, Nautilus, Prime, Eleiko, Rogue (US / Italy / international) + Korean brands (e.g. HASS, SP&CO, K-Sport). Chinese OEM brands explicitly excluded.
- **Equipment scope**: plate-load + pin-load strength machines only. Cardio (treadmill, bike, rower) and free-weight / no-mechanism equipment (barbell rack, dumbbell rack, smith machine) excluded — they don't differentiate gyms enough to justify catalog slots, and free-weight rooms are already implicitly covered by brand alone.
- **Catalog size target**: 100~200 templates. Above 200 the picker UX (3-step closed list) starts to break down; below 50 OCR / NL search hit rate stays low.
- **Source workflow**: Claude does web search across brand catalog pages → extracts English model lists → proposes standard Korean transliterations from Korean fitness-community conventions (e.g. "Lat Pull Down" → "랫 풀다운"). User confirms / corrects in a single review pass before V8 migration writes the INSERT block. For Korean brands whose sites are weak in English or have inconsistent listings, user provides the model list directly.
- **Catalog growth post-launch**: item 11's admin queue + `pending_review = true` path absorbs user contributions for templates absent from this seed. No automated catalog-sync infrastructure in scope.

**To-do (groomed scope)**

- [x] **Brand list confirmation**: 24 brands locked (2026-05-20). Foreign 20 (Hammer Strength, Life Fitness, Technogym, Panatta, Hoist, Cybex, Matrix, Nautilus, Prime, Citadel, gym80, Booty Builder, Atlantis, Gymleco, Telju, Precor, Icarian, Star Trac, Watson, Freemotion) + Korean 4 (뉴텍, DRAX, Ultra Strength, LEXCO). HASS / SP&CO / K-Sport placeholders replaced — 뉴텍 (newtechworldwide.com) is the dominant domestic manufacturer with Advance pin + M-Torture plate lines; DRAX (draxfit.com), Ultra Strength (ultrastrength.co.kr), LEXCO (lexco.kr) cover the rest of the visibility curve. Eleiko + Rogue dropped (free-weight specialists, in-scope template count would be 0~5 each). Chinese OEM explicitly excluded.
- [x] **Per-brand catalog research**: WebFetch ✓ (Hammer Strength 18, Life Fitness Insignia 15, Technogym Selection 12, Citadel 8, Booty Builder 10, Gymleco 13, Telju 17, 뉴텍 25 from machine.assistfit.io, LEXCO 12 from ptsports.co.kr dealer, Ultra Strength 14). ◐ (Cybex 10, Atlantis 8, Star Trac 13, Watson 12 — WebSearch + dealer aggregator). ○ (Matrix 10, Hoist 12, Panatta 10, Prime 7, Nautilus 6, gym80 8, Freemotion 10, DRAX 8, Icarian 6, Precor 12, Technogym Pure Strength 6 — training knowledge, admin queue absorbs gaps per item 11). Total 281 templates.
- [x] **Korean transliteration proposal**: D5 띄어쓰기 표준형 적용 ("체스트 프레스", "랫 풀다운", "아이소 래터럴 로우"). D6 sub-line marketing names dropped from name_en/name_ko (Versa, Magnum, Eagle NX, ROC-IT, Sygnum, Hyper, V8, Discovery, Advance, On Him, MTS, Inspiration, Instinct, Leverage, EPIC, Animal, Single Stack, Diamond, SEC Plus, Master Pro, Falcon, Nautilus One, Welliv Pro, Pure Plate, Pure Kraft); movement descriptors retained (Incline / Decline / Seated / Iso-Lateral / Linear / Pendulum / Belt / 45° / Converging / Diverging).
- [x] **V8 migration**: `iron-spot-api/src/main/resources/db/migration/V8__catalog_bulk_seed.sql` — 24 brands + 6 categories + 281 templates via `WITH catalog AS (VALUES …) JOIN brands + categories ON name`. brand/category UUIDs deterministic (Panatta b0000001 + Life Fitness b0000002 + 등 c0000001 + 가슴 c0000002 reuse legacy test-fixture UUIDs; rest b1000003..b1000024 / c1000003..c1000006); templates use `gen_random_uuid()`. `ON CONFLICT (name) DO NOTHING` for brand/category re-run safety. Verified via psql replay (V1..V8 on fresh postgis/postgis:17-3.5): 24 + 6 + 281 INSERTs apply cleanly. → Shipped slice (a) `5737b02`.
- [x] **Test fixture impact**: none. `flyway.enabled: false` in `iron-spot-api/src/test/resources/application.yml` means V8 only applies in prod; tests use `init-test-db.sql` exclusively. Full API test suite passes unchanged with V8 in migrations dir.
- [x] **Picker UX validation**: with N=281 templates the TemplateStep search box is the primary entry point. ADR 0022 already designed for 200-400 envelope (`MACHINE_SECTION_ALWAYS_SHOW_SEARCH = 0` in `FilterSheet.tsx`). → **Carried forward and shipped via item 23 (brand-first accordion filter UI)**: the 3-section orthogonal layout was replaced with the brand-first accordion (`FilterSheetBrandAccordion`), matching user mental model when standing in a gym. ADR 0024 supersedes 0022. See item 23 below for slice breakdown.
- [x] **NL search prompt few-shot expansion**: `prompts/search-dsl.md` rule 2 split into English-canonical / Korean-canonical lists. 15 brands added (Citadel, gym80, Booty Builder, Atlantis, Gymleco, Telju, Precor, Icarian, Star Trac, Watson, Freemotion, DRAX, Ultra Strength, LEXCO English; 뉴텍 Korean). Eleiko / Rogue removed. New few-shot pins 뉴텍 → 뉴텍 (no translation). Eval suite +1 case (8 total, 20K tokens ≈ 20% of Groq TPD). → Shipped slice (b) `8ba24cd`.

**Out of scope (post-launch / Phase 6)**

- Automated brand-catalog sync (cron pulling brand sites). Item 11's admin queue + per-week `pending_review` histogram (H7) is the canonical post-launch growth path. Bulk sync vs. user-contribution-driven growth is decidable after launch data lands.
- Free-weight equipment (barbells, dumbbells, racks, smith machines). Folded back into a separate post-launch decision once the gym-equipment data model knows whether free-weight rooms need their own surface.
- Cardio equipment. Same reasoning — needs its own product framing (filtering / discovery) that isn't worth designing pre-launch.

**Reason to ship pre-launch**

Without a populated catalog, item 18's code lights up no value: picker shows zero brands, OCR finds zero matches, NL search has no template_id to hit. Item 18 plus item 22 are the matched pair that lets the contribution loop and the search loop both close. The data work is a one-time effort and ships ahead of launch so the first cohort sees a catalog that already covers the gyms they walk into.

### 23. Brand-first accordion filter UI (refactor ADR 0022)

**Current state**

ADR 0022 (`docs/adrs/0022-machine-template-filter.md`) shipped a 3-section orthogonal `FilterSheet` (운동 부위 → 브랜드 → 머신) sized for 200-400 templates with an always-on search box. Item 22 lands 281 templates × 24 brands and the design envelope holds, but the mental model is wrong: standing in a gym, the user thinks brand-first ("Hammer Strength 있는 곳") not dimension-first. The 3-section layout surfaces brand as one of three equal-weight chip clusters, burying the natural hierarchy.

**Locked decision (2026-05-21)**

Refactor `FilterSheet` to a hybrid layout:

- Top: global search bar (always visible, searches across `nameKo` + `nameEn` + `brandName`).
- Middle: 운동 부위 chips (6, always visible, optional sub-filter).
- Body: 24 brand cards in an accordion. Tap brand row → expands inline → machines grouped by body part inside.
- Selected chips collapse to a footer "선택 N" strip with AND/OR toggle (preserves ADR 0022 결정 4).
- Multiple brands can expand simultaneously.

Trade-offs vs ADR 0022:

- ✓ Idle cognitive load 281 chips → 24 brand rows.
- ✓ Brand-only quick filter still 1-tap (brand row).
- ✓ Body-part quick filter preserved as top chip row (cross-filters accordion contents).
- ✓ Cross-brand search preserved via top search bar.
- ⚠ Compound queries (Panatta A + Hammer B) cost more clicks (expand both brands) but more discoverable.
- ⚠ Implementation cost: `FilterSheet.tsx` 242 → ~450 lines; new ADR (0023? 0024?) documenting supersede.

**To-do**

- [x] Author ADR documenting the supersede + decision rationale (link to item 23 in the README). → Shipped as `docs/adrs/0024-accordion-filter-supersedes-0022.md` (Draft → flipped to Accepted in slice e). 0022 marked Superseded; index updated.
- [x] Refactor `FilterSheet.tsx` to accordion layout. `useFilters` state shape unchanged (filterIds in / chip render out); ADR 0022 결정 5 (loading_type drop) + 결정 6 (브랜드 직교) preserved. → Slice a (`FilterSheet.tsx` 243 → 280 LOC; new `FilterSheetBrandAccordion`, `FilterSheetMachineRow`, `FilterSheetSelectionStrip`; new `groupTemplatesByBrand` lib). Decisions locked pre-implementation via `/grill-me` session (see notes below).
- [x] ~~FlashList with sticky brand headers for virtualization~~ → **Reverted to ScrollView (Q7)**. N=24 brand rows always render; only expanded brands render their machine rows, so worst-case row count is ~100 (well under FlashList's threshold). FlashList migration is reserved as a future hedge if catalog growth pushes total rendered rows past ~300.
- [x] Reanimated layout animation for accordion expand/collapse. → Slice c. `LinearTransition.springify().damping(18)` for the row reflow, `FadeIn 180 / FadeOut 140` for the body. `useReducedMotion()` swaps in undefined for both so the system flag snaps the UI without ceremony.
- [x] Cross-filter behaviour: 운동 부위 chip selection narrows the accordion's machine sub-sections; brand expand state preserved across category filter changes. → Slice b. `groupTemplatesByBrand` takes `activeCategoryIds`; empty brands hide; brand-row count badges reflect the after-filter count (Q3).
- [x] Empty state per brand when 운동 부위 filter active but brand has 0 machines in that part. → Slice b — empty brands drop out of the accordion entirely; if every brand drops the body renders "필터에 맞는 머신이 없어요".
- [x] Maestro update: existing filter flows reference 3-section structure; accordion taps need new selectors. → Slice d. `filter-sheet-flow.yaml` swaps the obsolete "브랜드" / "머신" section assertions for the new "머신 또는 브랜드 검색" global-search-input assertion (only layout-agnostic text marker at sheet open).

**Pre-implementation grilling (2026-05-21)**

Locked via `/grill-me` session:

- **Q1**: search hides unmatched brands (vs grey-out — picked hide because N=24 means grey-out adds visual noise; the spring layout animation makes the restore smooth on clear).
- **Q2**: NL search auto-expands brands whose `parsedFilters.templateIds` they own; manual open is collapsed.
- **Q3**: brand-row count badge reflects the after-filter count (matches what the user sees on expand; trips the empty-brand hide path naturally).
- **Q4**: AND/OR toggle is a footer-strip Switch with the visible label "전체 보유" + verbose accessibilityLabel "선택한 머신 전체를 보유한 헬스장만". Only mounts when ≥2 machines selected.
- **Q5** (ADR 결정 3, restated): accordion machine rows omit the brand prefix (parent row is right above); footer chips restore the prefix for disambiguation.
- **Q6**: expand state is local to `FilterSheet` via `useState`; persists across sheet open/close while MapScreen is mounted; NL auto-expand merges into the set (never collapses), search-active state overrides the visible set with every visible brand and clears back on query reset.
- **Q7**: ScrollView throughout (FlashList rejected for slice a, kept as future hedge).
- **Q8**: 5 slices a/b/c/d/e.
- **Q8-extra**: focusing the global search input snaps the sheet to its max snap so the keyboard never hides the brand list.

**Out of scope**

- "See also" cross-brand suggestions inside expanded brand view (e.g. "유사: Tech Iso Row")
- Drag-to-reorder favourite brands
- Brand-aware OCR weighting (separate item; ranks closest-match by gym's known inventory)

**Reason to ship pre-launch**

ADR 0022 envelope holds at 281 mechanically, but new-user onboarding sees the wrong primary axis. The first-cohort UX value is highest when the filter matches how users actually think about gym equipment. Refactor is contained to one component + one ADR; no backend / DTO / schema changes.

### 24. Bilingual brand labelling — show English + Korean side-by-side

**Current state**

`brands.name` is a single TEXT column (V1 baseline). V8 seeded the 24 launch brands with their canonical English / Latin-script names: `Panatta`, `Hammer Strength`, `Life Fitness`, `Technogym`, `BodyMaster`, `DRAX`, `뉴텍`, etc. The accordion FilterSheet (item 23) renders this single string verbatim — Korean users see "Hammer Strength" and have to mentally re-romanise to recognise "해머 스트렝스". Item 18 solved this asymmetry for machine templates (split `name` → `nameEn` + `nameKo`); brands were left single-column at the time because the catalog was still small.

**Triggering signal**

Same mental-model gap that drove item 18 + item 23. The launch-cohort catalog (item 22, 24 brands) is predominantly Anglo-named, but the Korean cohort thinks in 한글 first — surfacing only English in the brand accordion row + the footer chip prefix loses recognition speed on every glance.

**To-do (groomed scope)** — closed 2026-05-22 (5-slice PR).

- [x] Backend schema: V11 migration. `ALTER TABLE brands ADD COLUMN name_ko TEXT;` Backfill the 24 launch brands — Hangul transliteration for Anglo names (Panatta → 파나타, Hammer Strength → 해머 스트렝스, Life Fitness → 라이프 피트니스, …; user-confirmed overrides during 2026-05-22 grill: DRAX → **디랙스**, Telju → **텔유**, gym80 / 뉴텍 stay verbatim with `name_ko = name`). Keep `name` UNIQUE as the canonical key; `name_ko` NOT NULL but without a UNIQUE constraint (regional spelling variants of the same canonical brand coexist as long as the English `name` is distinct). Defensive final `UPDATE ... WHERE name_ko IS NULL SET name_ko = name` catches admin-promoted brands inserted between V8 and V11. Full 24-row mapping lives in `V11__brands_name_ko.sql` as canonical source.
- [x] DTO: `BrandResponse` gains `nameKo: string`. `MachineTemplateResponse.brandName` keeps the canonical English semantic + adds `brandNameKo` (mirrors item 18's `nameEn` / `nameKo` pattern). `GymMachineResponse.brandNameKo` likewise. `PromoteContributionRequest.newBrandNameKo` required when kind='newBrandAndTemplate' because V11 made `brands.name_ko` NOT NULL — admin form requires both English + Korean inputs. OpenAPI + Orval regen.
- [x] FE display helpers (two contexts):
  - `formatBrandLabel(brand)` — `"{nameKo} ({name})"` when both differ, plain `{nameKo}` (or `{name}` when nameKo missing) when they match. Used in **brand-as-primary-label surfaces** (filter accordion row, MachinePicker brand step, MachineList section header, brand-only chip).
  - `brandShortName(brand)` — Korean primary (`nameKo || name`). Mirrors item 18's `templateDisplayName` pattern. Used in **brand-as-prefix compound contexts** (template chip with brand+machine, MachinePicker TemplateStep row).
- [x] Surfaces updated (5 of 5 + admin form):
  - FilterSheet brand accordion row (`FilterSheetBrandAccordion.tsx`) — `formatBrandLabel`
  - FilterSheet footer chip (`formatMachineTemplateLabel` in `active-filters.ts`) — `brandShortName` (compound stays compact)
  - MachinePicker brand step (item 11 slice 3) — `formatBrandLabel`; TemplateStep row also uses precomputed `brandLabel` via `brandShortName` so both steps within the same picker render consistently
  - GymDetail / MachineList section header — `formatBrandLabel`
  - Admin / Owner compound surfaces — intentionally stay English (locked branch 5 Q3 ②: internal users tend to use English); AdminPendingContributionScreen's NewBrandAndTemplateForm split brand input into 영문 + 한글 because V11's NOT NULL forces both
- [x] Visual hierarchy decision: lead with Korean and parenthesise English (matches user mental model + item 18 precedent). For global brands with strong English equity (Hammer Strength, Life Fitness) the parenthesised English keeps the global-recognition signal alive.
- [x] Tests: 10 `formatBrandLabel` / `brandShortName` unit cases + FilterSheet / MachineList / MachinePicker RTL bilingual assertions; backend `BrandFuzzyResolverIT` (7 cases) + `FuzzyMatchServiceTest.findMatchesIncludesKoreanBrandLabelInOcrTarget` + admin promotion IT asserting `brands.name_ko` storage.

**Out of scope**

- Localised brand sort order (Korean brands group separately from English-canonical ones). Default alphabetical (locale-aware `localeCompare(name, 'ko')`) is good enough at N=24.
- Brand logos. Not in the launch catalog; if added, a separate item.

**Reason to ship pre-launch**

Same as items 18, 19, 23: the launch cohort is Korean-speaking, and surfaces that lead with English-only hurt recognition speed on the most common interactions (filter open, chip read, machine row scan). Self-contained — V11 migration + two helpers + ~5 render sites. No NL search wire-format change (internal: `BrandRepository.findIdByNameOrKoFuzzy` expands to a 3-stage resolver — exact case-insensitive → whitespace-stripped → Levenshtein similarity ≥ 0.6 — over the 24-row catalog, so Korean queries like "해머스트렝스 풀다운" resolve without prompt drift).

### 25. Brand product-line (series) catalog layer

**Current state**

- Brands market their machines under product-line names ("Master Pro" for LEXCO, "Pure Kraft" for gym80, "Iso-Lateral" for Hammer Strength). The name printed prominently on the machine body is the series, not the brand.
- Pre-V27 the catalog had only Brand → Template. Users opening 직접 입력 typed what they read off the machine ("Master Pro Leg Extension") into the brand search box, the brand fuzzy resolver couldn't match it against LEXCO, and they were forced down the propose-new path. The contribution landed in the admin queue orphaned from LEXCO — admin then had to parse the free-text manually to reconstruct the brand link.
- OCR brand anchoring (`FuzzyMatchService`) recognised brand tokens but had no notion of series, so a Lexco label that read "MASTER PRO LEG EXTENSION" couldn't narrow suggestions to the Master Pro line even when other Lexco product lines existed.

**Shipped (2026-05-28, branch `feat/machine-series-layer`)**

- [x] V27 migration: `machine_series` table (brand_id FK, name, name_ko, UNIQUE per brand) + `machine_templates.series_id` NULLABLE FK + partial index + RLS deny-by-default. `init-test-db.sql` mirrors the DDL.
- [x] Catalog seed: 74 high-confidence series across 18 brands (web-verified against official manufacturer sites). 8 brands intentionally have no series (Ultra Strength, Star Trac, Icarian, Booty Builder, Gymleco, Citadel, Watson, MegaMass). MegaMass added as a new US brand at `b1000027`. Names stored English-only — every machine prints its series in Latin — so `name_ko = name` on every row (mirrors gym80 brand precedent).
- [x] `GET /api/series` endpoint + `useSeries` hook. Closed catalog (~74 rows), full list fetched once and narrowed offline, same pattern as `/api/brands`.
- [x] `MachineTemplateRepository.findAllApprovedDetailed` + the wire DTO gain optional `seriesId` filter + field so the picker can group/filter by series without an extra round trip. `useMachineTemplates({ seriesId })` supported.
- [x] OCR series anchoring in `FuzzyMatchService`: once a brand is recognised in OCR, the matcher consults series of that brand and, if a series's name tokens are wholly present in the input, restricts candidates to templates with that `seriesId`. Cross-brand series (Cybex's "Eagle NX" in a Lexco photo) are ignored because their parent brand wasn't anchored.
- [x] Admin promote: `PromoteContributionRequest` gains optional `seriesId` (existing series under brandId) and `newSeriesName` (creates a new series). Mutually exclusive. `newBrandAndTemplate` accepts `newSeriesName` only since a brand-new brand has no existing series. `existingTemplate` rejects both — that template's `seriesId` is intrinsic.
- [x] Unified discovery step on the manual-input flow: `UploadManualInputScreen`'s first step now searches brands AND series in a single merged list. Picking a series row anchors both brand + series and the template step shows only that line's machines; picking a brand keeps the existing behaviour. EntityPick discriminated union (brand | series | proposed) replaces BrandPick.

**Reason to ship pre-launch**

The orphaning problem is most acute on the very first surface a Korean user touches — the manual-input flow opened from "직접 입력" when there's no label to OCR. Pre-V27, the most-photographed brand (LEXCO) and its flagship line (Master Pro) were guaranteed to land in the propose-new path because the catalog had no way to bridge "Master Pro" to "LEXCO". Series is the missing search-resolution layer that turns the launch-cohort failure case into a closed-list pick.

## Post-launch hypotheses (drive prioritisation)

Each Phase 5 task ships only when the matching hypothesis is either confirmed or falsified by real data. Phase 4 closed without users so all of these are pre-decisions waiting on evidence.

| H   | Hypothesis                                                                                                                                                                  | Falsifiable by                                                                                                                                          | Drives                                                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| H1  | Auto-ban thresholds (3 actioned / 5 dismissed) catch real bad actors without false-banning newcomers.                                                                       | Logged ban events with `disposition_count >= 1 plus banned_at within 7 days of first contribution` versus per-user dismissed-but-not-banned histograms. | Items 1, 2                                                                   |
| H2  | NL search has enough query repetition to make caching worth the eviction complexity.                                                                                        | Hash of normalised query text shows top decile accounting for greater than 30 percent of monthly volume.                                                | Item 5                                                                       |
| H3  | Owner workflow (Task 47) actually distributes load — owners action greater than 50 percent of their gym's reports within 24 hours before the escalation cron fires.         | `admin_queue_items.dispositioned_by_owner_count / total_owner_targeted` per gym.                                                                        | Sequencing of item 1 (delays it further)                                     |
| H4  | Daily active users exceed 50 within the first month.                                                                                                                        | Sentry sessions, Supabase auth `last_sign_in_at`.                                                                                                       | Whether to build item 7 (PostHog) before item 4 (push).                      |
| H5  | Photo PII rejection (Task 42) catches the bulk of face uploads without users complaining about false rejections.                                                            | Sentry breadcrumbs from `PhotoService.upload` plus user-support email volume to `yyou017@gmail.com`.                                                    | Whether to relax the B3 threshold or add mosaic fallback (Task 42 option A). |
| H6  | Korean-only at launch is acceptable for the first cohort. **Locked as confirmed pre-launch (2026-05-20)** — overseas usage out of scope, i18n beyond Korean out of Phase 5. | n/a (locked).                                                                                                                                           | i18n scope decision (out of Phase 5).                                        |
| H7  | Real users submit machine names absent from the 11-template launch seed at a rate that justifies an admin promotion queue rather than a one-off bulk seed.                  | `unverified_machine_names` inserts per week once item 11 ships the persistence path. Compare distinct-name volume to admin curation throughput.         | Item 11 admin queue UI and the optional bulk-seed decision.                  |

## Measurement plan

To make the hypotheses above observable, Phase 5 needs lightweight telemetry beyond what Sentry plus Supabase already give us.

### Available pre-launch (no Phase 5 work needed)

- **Sentry** — error rate, performance (transactions), session count. Already configured backend plus frontend.
- **Render dashboard** — request volume, error codes, p95 latency.
- **Supabase Auth** — sign-in volume, `last_sign_in_at` per user.
- **Slack `#ironspot-deploy`** plus `#ironspot-errors` — production cadence and error spikes.
- **App Store Connect** — install count, crash rate, ratings.

### Needs Phase 5 wiring

- **PostHog** (item 7) for funnels and retention. Free tier allows 1M events per month, comfortable cushion for early-stage volume. Wire after item 4 (push) so notification CTR can be observed.
- **`reports.disposition_count` histogram** — already in the schema, needs a periodic SQL snapshot exported to a Slack channel or a tiny Render endpoint. Drives H1.
- **`nl_search` query log** — Phase 4 keeps no audit table for NL queries (only the monthly counter on `users`). H2 needs query text logging plus a daily rollup. Schema addition pre-requirement for item 5.
- **Owner action latency** — derived from `reports.created_at` and `reports.actioned_at` filtered by `disposed_by` in `users` with `role='owner'`. Already loggable, no schema change.

## Out of scope for Phase 5

Reserved for Phase 6 plus.

- Android Play Store submission — needs the same legal plus screenshot plus signing work as iOS, doubled. Phase 5 launches iOS first and only opens Android once H4 is confirmed.
- Standalone owner mobile app — only if Task 47 mobile-embedded owner screens prove insufficient.
- Internationalisation beyond Korean plus English — H6 driven.
- Public API for third-party integration — irrelevant without partner demand.
- Gamification (streaks, badges) — would need a measurable retention problem first.

## Transition notes (Phase 4 to Phase 5)

- **Phase 4 close** is whichever is later: (a) Task 49 admin-flow Maestro merged, or (b) App Store submission live. The two are sequential since Task 48 plus Task 49 plus EAS preview-simulator all unblock on the same Apple Developer enrolment event. See memory `project_apple_developer_deferral`.
- **Phase 5 does not fork** until launch signal (item above) is hit. Until then, Tier 3 items stay as Phase 4 README Future Tasks bullets and this file is the design holding pen.
- **No code lives on a `phase-5` branch** prior to launch. First Phase 5 task gets its own `task/<N>-<name>` branch off `main` after launch as usual.

## How to start Phase 5

After launch and once at least one of H1 to H6 is decidable from real data:

```
grill-me Phase 5 scope and Task 50 first slice
```

`grill-me` walks through which hypothesis has actually moved, locks acceptance criteria for the matching item, then `write-plan` (or manual implementation.md) per-task following the Phase 1 to Phase 4 cadence.

## Related documents

- `docs/plans/phase-4/PROGRESS.md` for Phase 4 close state
- `docs/plans/phase-4/implementation.md` Future Tasks section (canonical Tier 3 list, this file mirrors it)
- `docs/launch/pre-submission-checklist.md` for the launch gate that precedes Phase 5
- `docs/plans/architecture-design.md` for cross-phase architectural constraints
