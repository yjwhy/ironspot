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
- [x] **OCR-failure picker UI (3 closed-list steps + escape hatch)** — replaces today's `OcrFailView` plain text input. See `Closed-list autocomplete pattern` below. → Shipped slice 3 on `hotfix/phase-5-item-11-slice-3-closed-list-picker`. New `MachinePicker` component drives progressive disclosure (brand search/list → 5 fixed category chips → template list filtered by brand+category) with a persistent "리스트에 없어요?" link that reveals the free-text fallback. Mounts on both OCR-fail (always) and OCR-success (when user taps the "다른 기구로 등록" radio). `UploadConfirmScreen` refactored to a discriminated `selection: { kind: 'none' | 'template' | 'freeForm' }` state model so the OCR-radio path and the picker path share one register handler. Shared `selectedRowClass` helper + `MAX_OCR_SUGGESTIONS = 3` constant added to remove FF cohesion duplication flagged in pre-PR review. LLM ranking explicitly deferred to a follow-up hotfix per the 2026-05-20 decision. Follow-ups: (a) `useBrands` / `useCategories` / `useMachineTemplates` now have 4 cross-feature consumers (upload, owner, admin + map) so the next refactor pass should move them to `src/shared/hooks/catalog/` or `src/features/catalog/hooks/` and split `mapKeys.{brands,categories,machineTemplates}` into a `catalogKeys` namespace; (b) `TemplateStep`'s client-side `brandId`/`categoryId` filter is coupled to the DTO field names, item 18's `nameKo` migration is the natural moment to push the filter into `useMachineTemplates({ brandId, categoryId })` instead.
- [ ] Admin: add a queue view that lists `pending_review = true` rows, lets the admin (a) promote by mapping to an existing template, (b) create a new template plus optionally a new brand, or (c) reject. Folds into the existing admin dashboard rather than a new screen if volume stays low.
- [ ] Telemetry: count per-week `pending_review = true` inserts so we can falsify hypothesis H7 below.
- [ ] (Optional, larger) Bulk-seed the template catalog from a public gym-equipment dataset to raise OCR hit rate before launch instead of relying entirely on user direct-input. Decide at Phase 5 kickoff based on H7 volume signal.
- [ ] **Orphan upload rate limit + reaper** — Slice 2 makes `POST /api/photos/upload` accept a missing `gymMachineId`, which lets an authenticated user fill `<bucket>/orphan/<userId>/` with 2 MB images without ever calling `POST /api/gym-machines`. Two gaps still open: (a) per-user quota on orphan inserts (no rate limiter exists in `iron-spot-api` today — would land as a `bucket4j` Spring Boot starter or a simple `COUNT(*) WHERE gym_machine_id IS NULL AND created_at > now() - interval '1 hour'` precheck in `PhotoService.upload`); (b) cleanup job that purges Storage + `machine_photos` rows still orphan past N hours. Slice 4 (admin queue) is the natural home for the reaper since the same query (`pending_review = true` OR `gym_machine_id IS NULL`) feeds both surfaces. Vision API spend per upload also has no ceiling — consider folding into the same quota.

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

- [ ] Reproduce: dev-build the simulator with `pnpm dev:prod`, set the iOS simulator location to Auckland (`xcrun simctl location booted set -36.8485,174.7633`), search "강남역 헬스장", confirm the same zoomed-out finish. Compare against starting in Seoul.
- [ ] Decide camera strategy. Three options to grill: (a) jump-then-animate (no-anim `setCamera` to a point near the destination then short `animateCameraTo` for the polish — bypasses the long-distance cinematic), (b) animate with explicit zoom (pass `zoom: derivedFromRadius` and accept a one-frame marker race that the existing `CAMERA_DEFER_MS` already partially mitigates), or (c) avoid animation for jumps over a threshold (e.g. > 500 km — instant snap + defer markers).
- [ ] Thread `resolvedLocation.radiusKm` into the zoom calculation. Rough mapping: 1 km → 15, 3 km → 13, 5 km → 12 (Web Mercator approximation). Lock the curve via Naver SDK's `fitBounds` if it accepts a centre + radius, otherwise hand-roll.
- [ ] Side concern: starting camera fallback when GPS resolves outside Korea. Today the first camera is the user's GPS, which means the rare overseas tester (e.g. the developer) sees their current country before the first NL search. Per the locked "Korean users only" scope decision (see end of section), we do not need to support overseas usage — the fix here is a clamp: if `initialLocation` falls outside the Korea bounding box (roughly lat 33–39, lng 124–132), fall back to a fixed Korean centre (서울시청 좌표) at zoom 14 so the first camera always lands on Korea and the subsequent NL search never has to cross a long-distance jump.
- [ ] Coverage: extend the existing MapScreen camera test (if present) with two cases — short-distance pan keeps zoom 14, long-distance jump lands on `derivedZoom = f(radiusKm)`.

**Recommended solution (ui-ux-pro-max review, 2026-05-20)**

Use NaverMap's `setBounds` / `fitBounds` if the SDK exposes it: centre = `resolvedLocation.coordinates`, padding derived from `radiusKm × 1.3` so all markers sit inside the visible viewport. If the SDK only accepts a zoom integer, derive it from radius via Web Mercator approximation `zoom = round(15 − log2(radiusKm))` (1 km → 15, 3 km → 13, 5 km → 12). For long-distance jumps (start↔end > 500 km), bypass the cinematic animation entirely — call `setCamera` (instant, no transition phase) so the SDK's auto zoom-out never fires, then trigger the existing marker reveal pipeline after a slightly longer `CAMERA_DEFER_MS` (~150 ms) to absorb settle time. Quick Reference §7 `layout-shift-avoid` + `interruptible` + `motion-meaning` apply: the cinematic loses meaning when the start point is in a different country; a clean instant snap reads as "search jumped" while an animated zoom-out reads as confused intent.

**Reason to ship pre-launch (re-classified 2026-05-20)**

Originally filed as a Phase 5 holding-pen item under the assumption it only hit overseas testers. That was wrong on two counts:

1. The missing zoom argument is distance-independent. Every NL search where the user-supplied radius differs from the current camera zoom produces an off-spec viewport. Domestic example: 강남에서 "성수역 2km 반경 헬스장" 검색 → 카메라는 성수역으로 이동하지만 zoom 14 유지 → 2 km 반경이 화면에 안 들어옴. The product spec ("radius is what the user asked for") is silently violated on every multi-radius query.
2. Long-distance cinematic still triggers inside Korea — 서울 ↔ 부산 ~325 km, 서울 ↔ 제주 ~450 km. Both are realistic travel scenarios for a launch cohort. The Naver SDK's exact threshold is unverified, so even shorter intra-Korea jumps may trigger it.

Treat as pre-launch hotfix: thread `radiusKm` into the zoom calculation first (closes the spec violation), then layer the long-distance `setCamera` bypass once SDK repro pins down the threshold.

### 14. Unregistered gym card tap routes the user to a duplicate search step

**Current state**

Reported by the user during the same 2026-05-20 review on a physical iPhone. The NL search bottom sheet's `UnregisteredGymCard` advertises "첫 등록자 되어 정보 추가하기" but tapping it routes to `/(upload)/gym-select?openNewGym=1&initialQuery=<name>` — the "새 헬스장 등록" screen — and the user has to **Naver-search the same name again and pick the same place** before getting to the camera. The `UnregisteredPlace` object already carries `naverPlaceId`, `name`, `address`, `latitude`, `longitude`, so the search-then-select step is pure friction.

**To-do (groomed scope)**

- [ ] Frontend: replace the `router.push('/(upload)/gym-select', ...)` in `MapScreen.handleUnregisteredPress` with a direct `useCreateGym(place)` call (Naver place fed straight into the existing mutation).
- [ ] On mutation success, route to `/(upload)/camera?gymId=<newGymId>` so the user lands on the camera with the new gym pre-bound.
- [ ] Add an "undo" toast on the camera screen for ~5 s ("○○를 등록했어요 · 취소") that rolls back the gym row if tapped. Persisted state hand-over via expo-router params, not a global store.
- [ ] Telemetry: count gym-row rollbacks per week — if > 5 % we re-add a confirmation modal.

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

- [ ] Add a "길찾기" chip on `GymCard` (bottom sheet, next to the address line) and a header-right "길찾기" button on `GymDetail`. Both wired to a shared `openDirections(gym)` handler.
- [ ] Handler: `Linking.canOpenURL('nmap://')` → if true and `naver_place_id` exists, open `nmap://place?id=<id>&appname=com.ironspot.app`; if true with no place id, open `nmap://route/public?slat=<userLat>&slng=<userLng>&dlat=<gymLat>&dlng=<gymLng>&dname=<encodedName>&appname=...`; if false, fall back to `https://map.naver.com/v5/search/<encoded>` via WebBrowser.
- [ ] Origin policy: default to current GPS. When the NL response carried a `resolvedLocation` reference point (e.g. "강남역"), surface a one-time ActionSheet "현재 위치 / 강남역에서" on first tap of the session and remember the choice. Skip the sheet for "내 주변" / no-reference searches.
- [ ] Native config: add `LSApplicationQueriesSchemes: ["nmap"]` to `app.config.ts` under `ios.infoPlist`. **Native rebuild required** — batch with other native changes if any.
- [ ] Telemetry: count taps per session to validate the affordance is being discovered. If <10 % conversion from gym detail to directions tap after 4 weeks, move the entry point to a more visible slot.

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

- [ ] DB: add `gyms.cover_photo_url TEXT NULL` via a new Flyway migration. Nullable — most gyms will not have one for a long time.
- [ ] Backend: extend `GymResponse` / NL search response to surface `coverPhotoUrl`. Existing repository methods filter by `owner_id` already so the upload endpoint check is one line.
- [ ] Owner upload screen: in the Task 47 "내 매장 관리하기" surface, add a "대표 사진" section — upload, preview, remove. Reuse the existing photo upload pipeline (Vision SafeSearch + PII check) but skip the OCR + machine-binding steps.
- [ ] Frontend: thread `coverPhotoUrl` through `useMapSearch`, `useNlSearch`, and gym detail into `GymCard`'s existing `thumbnailUrl` prop. Placeholder stays when null.
- [ ] Test coverage: backend IT for owner-only upload (403 for non-owner), frontend test that `GymCard` renders the placeholder when `thumbnailUrl` is null and the image when set.

**Recommended solution (ui-ux-pro-max review, 2026-05-20)**

Owner-only upload keeps every cover photo accountable to a verified business identity, sidesteps the third-party copyright problem entirely, and gives Task 47 owners a tangible reward for completing verification (their photo, not anonymous user-submitted content, represents their gym). Quick Reference §4 `style-match` (cover photo is a brand expression, belongs to whoever owns the brand) and §1 `color-not-only` apply: when no cover is set the placeholder must still convey hierarchy via the gym name + distance metadata, not visually collapse to "broken card". Keep the placeholder neutral and consistent across cards so the visual rhythm of the bottom sheet stays stable as cover photos populate gradually.

**Reason this sits in Phase 5**

Depends on Task 47 owner workflow being merged + a measurable number of owners having gone through verification. Pre-launch there are zero verified owners so the feature would have no real data. Ships when owner verification volume hits double digits — until then the placeholder is the right state.

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

**To-do (groomed scope)**

- [ ] DB: rename `machine_templates.name` → `name_en`, add `name_ko TEXT NOT NULL` via a new Flyway migration. Backfill 11 existing rows by hand (small set, no script).
- [ ] Backend: extend `MachineTemplate` DTO to surface both fields; extend `FuzzyMatchService.findMatches` and `findTemplateIds` to tokenise both columns when computing Jaccard similarity.
- [ ] OpenAPI + Orval regen: TypeScript client picks up the two fields.
- [ ] Frontend: render `nameKo` on `GymCard`, `MachineList`, NL search interpretation chip; render both on `MachineDetail`.
- [ ] NL search prompt: extend the LLM prompt so it understands Korean machine-name aliases and emits canonical English when filling `parsedFilters.templateIds`.
- [ ] Test coverage: `FuzzyMatchService` test cases for `해머스트렝스 랫 풀다운` matching `Hammer Strength Lat Pull Down`; frontend test that `GymCard` renders `nameKo` and `MachineDetail` renders both.

**Recommended solution (ui-ux-pro-max review, 2026-05-20)**

Option C is the right balance for the launch cohort. Brands stay English because gym-goers recognise them that way and machine bodies are labelled in English, so the card matches the physical world. Machine names compound poorly in English for native Korean speakers ("Panatta Chest Press" reads slower than "Panatta 체스트 프레스"), so Korean primary speeds card scanning. The English secondary line on detail preserves the precise reference for users who want to look up the exact model. Quick Reference §6 `text-styles-system` (clear hierarchy via weight/size between primary and secondary), §6 `letter-spacing` (respect Korean character spacing defaults), and §1 `dynamic-type` (both lines must survive system text scaling) apply.

**Reason to ship pre-launch**

NL search input today silently fails on Korean machine-name aliases — a domestic user typing 해머스트렝스 풀다운 gets zero results even though the gym has it. That's a core-flow regression for the launch cohort. Plus the catalogue is only 11 templates, so the translation work is one-time and trivially small.

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

- [ ] Frontend: drop the machine-name list from `GymCard.tsx`. Replace with the single `등록된 기구 N대` line; render `아직 등록된 기구가 없어요` when N=0.
- [ ] Test coverage: update existing `GymCard.test.tsx` snapshots / assertions to match the new layout; add a case for the `N=0` copy.
- [ ] Side fix: confirm the same simplification is consistent across NL-search-result cards and filter-result cards (both render through `GymCard`).

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

- [ ] `src/features/gym/types.ts`: `GymBottomSheetMode` list variant 에 `hasActiveFilters?: boolean` optional 필드 추가.
- [ ] `src/features/map/hooks/useBottomSheetMode.ts`: `hasActiveFilters` 를 파라미터로 받아서 list mode 에 그대로 매핑.
- [ ] `src/features/map/components/MapScreen.tsx`: 기존 `activeFilterCount` 계산을 `hasActiveFilters = activeFilterCount > 0` 로 파생해 훅에 주입.
- [ ] `src/features/gym/components/GymBottomSheet.tsx` `ListMode`: `nlEmpty` 분기 다음에 `hasActiveFilters === false` 분기 추가. NL 모드는 그대로 우선.
- [ ] 테스트: `GymBottomSheet.test.tsx` — 새 카피 + 버튼 비노출 케이스 2개 추가, 기존 "필터 활성 + 결과 0개" 케이스는 `hasActiveFilters: true` 로 명시. `useBottomSheetMode.test.ts` — `hasActiveFilters` 패스스루 케이스 1개 추가.
- [ ] Korean natural language 준수 (memory `feedback_korean_natural_language`): "아직" 어휘는 contribution 유도 + 데이터 보완 중임을 정직하게 알리는 톤. 영문 템플릿 직역 금지.

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

- [ ] `src/features/gym/components/GymBottomSheet.tsx` `buildSortedList`: 2단 비교자 적용. `(a.kind === 'gym' ? 0 : 1) - (b.kind === 'gym' ? 0 : 1) || a.distanceKm - b.distanceKm`.
- [ ] 테스트: `GymBottomSheet.test.tsx` — (a) 가까운 미등록 + 먼 등록 → 등록 먼저, (b) 등록만 → 거리 정렬, (c) 미등록만 → 거리 정렬, (d) 동거리 혼합 → 등록 먼저.
- [ ] Item 20 와 같은 PR 에 묶음. 두 변경 모두 BottomSheet list mode 동작 + 같은 파일 라인 근접.
- [ ] 코드 코멘트: 거리 기대 위반(먼 등록이 가까운 미등록 앞에) 의 trade-off 를 명시. launch 초기 정책임을 future 독자에게 알림.

**Recommended solution (2026-05-20 grill-me)**

옵션 A 가 launch timing 에 가장 강력하다. 등록 수가 극단적으로 적은 launch 직후엔 등록을 무조건 위로 노출해 "우리가 아는 헬스장이 있긴 있다" 시그널을 보호하고, 데이터가 풍부해진 뒤엔 1차 키가 자동으로 무력화돼 거리 정렬로 수렴하므로 future migration 비용 0. 옵션 B (섹션 분리) 는 BottomSheet 25% snap 의 카드 공간을 헤더가 차지해 시각 비용이 크고, 옵션 C (톤 차이) 는 정렬 정책 자체는 안 바꾸므로 본질 문제를 보조 신호로만 가림. Quick Reference §5 `content-priority` (등록이 product 의 1차 자원), §1 `clear-language` (미등록을 등록과 시각적으로 동등하게 두지 않기) 적용.

**Reason to ship pre-launch**

launch 직후 등록 헬스장이 viewport 안에 있어도 미등록이 더 가까우면 list 의 first impression 을 미등록이 차지함. 사용자는 "이 앱은 비어 있다" 결론을 내리고 이탈 가능성 ↑. Item 20 (empty-state 카피) 와 같은 BottomSheet list mode 의 사용자 신뢰성 문제군이라 같은 hotfix branch / 같은 PR 에서 묶어 처리한다.

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
