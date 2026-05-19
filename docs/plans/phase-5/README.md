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

### 11. Machine template catalog growth plus OCR direct-input persistence

**Current state**

- `brands`, `categories`, `machine_templates` are seeded manually into Supabase prod (Flyway `V1__baseline.sql:21` explicitly excludes seeds). At launch the catalog is 5 brands + 5 categories + 11 templates.
- `OcrService` plus `FuzzyMatchService` only suggest templates that already exist in `machine_templates` (Jaccard threshold 0.25). OCR cannot self-register an unknown brand or machine.
- `UploadConfirmScreen.tsx:238` collects the user's free-text fallback name but `handleRegister` carries a `// TODO: call registerMachine(...)` and just shows a "사진이 등록됐어요!" toast plus `router.back()`. The text is **discarded**; only the photo lands in Storage plus `photos`, never bound to a `gym_machines` row. The user reads it as success but the photo becomes an orphan.
- Same gap applies when OCR succeeds but the suggested templates are all wrong and the user picks the "직접 입력" radio.

**To-do (groomed scope)**

- [ ] Backend: add `POST /api/gym-machines` (or extend existing endpoint) that accepts `{ gymId, freeFormName, brandHint?, categoryHint? }` and persists into a new `unverified_machine_names` queue table (or `gym_machines` with `template_id = NULL` plus a `pending_review` flag, decision in grill).
- [ ] Backend: bind the orphaned photo to the new row inside the same request so the upload flow finishes with a real `gym_machine_id`.
- [ ] Frontend: replace the `// TODO` in `UploadConfirmScreen.tsx:238` with a real call. Toast copy stays optimistic but reflects truth ("등록 요청을 보냈어요, 검토 후 반영돼요" or similar).
- [ ] Admin: add a queue view that lists pending free-form names, lets the admin (a) promote to an existing template, (b) create a new template plus optionally a new brand, or (c) reject. Folds into the existing admin dashboard rather than a new screen if volume stays low.
- [ ] Telemetry: count per-week `unverified_machine_names` inserts so we can falsify hypothesis H7 below.
- [ ] (Optional, larger) Bulk-seed the template catalog from a public gym-equipment dataset to raise OCR hit rate before launch instead of relying entirely on user direct-input. Decide at Phase 5 kickoff based on H7 volume signal.

**Reason to defer past launch**

The decision between "let the queue grow and curate" versus "bulk-seed first" is undecidable without real submission volume. Shipping the persistence path before launch is enough to stop losing user submissions; the admin promotion UI plus bulk-seed scope answer to H7 evidence.

### 12. Photo upload / OCR error path needs reproduction and triage

**Current state**

Reported by the user during the same 2026-05-19 device-testing session: capturing a photo and submitting it surfaces an error rather than reaching the OCR success / fail confirm screens (`UploadConfirmScreen`'s `OcrFailView` already covers the empty-suggestion path — this error is upstream of that). Exact error text, the failing screen, and whether it is reproducible across machines plus gym types are not captured yet, and `xcrun simctl spawn booted log show ... grep ocr|photo|upload` returned no matches in the 2-minute window after the report so the error is not fresh in device logs either.

**To-do (groomed scope)**

- [ ] Reproduce on the simulator with `pnpm dev:prod`: pick a gym → 사진 업로드 → capture an image → record the exact error copy plus screen and attach a Maestro-driven repro flow under `.maestro/flows/`.
- [ ] Pull the failing request from device logs (`xcrun simctl spawn booted log show --predicate 'process == "IronSpot"' --last 5m --style compact | grep -iE 'photo|vision|ocr|/api/'`) plus the corresponding Render log entry, plus the Sentry event if one was emitted.
- [ ] Classify the failure: Vision API 5xx, Supabase Storage upload failure, multipart parsing, response shape mismatch, or pre-OCR image compression. The branch decides whether the fix lives in `PhotoService.upload`, `OcrService.analyzeImage`, `StorageService.upload`, or the frontend `usePhotoUpload` hook.
- [ ] Decide whether to fail-open to `OcrFailView` (graceful degrade to the existing manual-input path) versus showing a user-actionable error toast. Same trade-off as the `vision = VisionAnalysisResult.EMPTY` fallback already in `PhotoService.upload:60` for Vision failures.
- [ ] Add the error path to the test suite — Photo upload IT covering the failing branch, frontend test covering the toast / fallback copy.

**Reason this sits in Phase 5**

Pre-launch decision: triage now, ship a fix once we know the failure mode. If the root cause is a backend bug rather than a UX gap it pulls forward to a pre-launch hotfix branch. If it is a Vision API rate-limit or transient 5xx it folds into the same fail-open path as the existing OCR-fail flow plus item 11's persistence pipe and ships together.

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
- [ ] Side concern: starting camera fallback for overseas testers. Today the first camera is the user's GPS; a Korean fallback centre (e.g. 서울시청 좌표) once NL search is the dominant entry path would shorten the long jump that triggers the SDK behaviour. Adds a Phase 5 i18n thread but the immediate fix is camera strategy, not entry-point.
- [ ] Coverage: extend the existing MapScreen camera test (if present) with two cases — short-distance pan keeps zoom 14, long-distance jump lands on `derivedZoom = f(radiusKm)`.

**Recommended solution (ui-ux-pro-max review, 2026-05-20)**

Use NaverMap's `setBounds` / `fitBounds` if the SDK exposes it: centre = `resolvedLocation.coordinates`, padding derived from `radiusKm × 1.3` so all markers sit inside the visible viewport. If the SDK only accepts a zoom integer, derive it from radius via Web Mercator approximation `zoom = round(15 − log2(radiusKm))` (1 km → 15, 3 km → 13, 5 km → 12). For long-distance jumps (start↔end > 500 km), bypass the cinematic animation entirely — call `setCamera` (instant, no transition phase) so the SDK's auto zoom-out never fires, then trigger the existing marker reveal pipeline after a slightly longer `CAMERA_DEFER_MS` (~150 ms) to absorb settle time. Quick Reference §7 `layout-shift-avoid` + `interruptible` + `motion-meaning` apply: the cinematic loses meaning when the start point is in a different country; a clean instant snap reads as "search jumped" while an animated zoom-out reads as confused intent.

**Reason this sits in Phase 5**

Direct workaround for the user (search inside Korea, or re-search from a closer start point) keeps this from being a launch blocker. The grill between options (a)/(b)/(c) needs SDK-level repro plus the existing marker-mount race to be re-checked, both of which are too speculative to PR pre-launch without device verification.

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

- [ ] Add a Material FAB ("+", label "사진 추가") floating bottom-right in `GymDetail`, above `MachineList`.
- [ ] FAB tap routes to `/(upload)/camera?gymId=<id>` with no machine pre-selected; the camera screen runs OCR, matches against `machine_templates`, and either re-uses an existing `gym_machines` row for this gym or creates a new one bound to the matched template.
- [ ] OCR no-match path folds into item 11's direct-input persistence (carry `gymId` so the orphaned-photo bug item 11 fixes does not regress here).
- [ ] Fix `MachinePhotoGalleryScreen.handlePressUpload` to push `/(upload)/camera?gymId=<id>&prefMachineId=<machineId>` so the camera lands pre-bound to both gym + machine.
- [ ] Test coverage: `GymDetail` renders FAB above `MachineList`; FAB tap calls `router.push` with the gym ID; `MachinePhotoGalleryScreen.handlePressUpload` carries gymId.

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

## Post-launch hypotheses (drive prioritisation)

Each Phase 5 task ships only when the matching hypothesis is either confirmed or falsified by real data. Phase 4 closed without users so all of these are pre-decisions waiting on evidence.

| H   | Hypothesis                                                                                                                                                          | Falsifiable by                                                                                                                                          | Drives                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| H1  | Auto-ban thresholds (3 actioned / 5 dismissed) catch real bad actors without false-banning newcomers.                                                               | Logged ban events with `disposition_count >= 1 plus banned_at within 7 days of first contribution` versus per-user dismissed-but-not-banned histograms. | Items 1, 2                                                                   |
| H2  | NL search has enough query repetition to make caching worth the eviction complexity.                                                                                | Hash of normalised query text shows top decile accounting for greater than 30 percent of monthly volume.                                                | Item 5                                                                       |
| H3  | Owner workflow (Task 47) actually distributes load — owners action greater than 50 percent of their gym's reports within 24 hours before the escalation cron fires. | `admin_queue_items.dispositioned_by_owner_count / total_owner_targeted` per gym.                                                                        | Sequencing of item 1 (delays it further)                                     |
| H4  | Daily active users exceed 50 within the first month.                                                                                                                | Sentry sessions, Supabase auth `last_sign_in_at`.                                                                                                       | Whether to build item 7 (PostHog) before item 4 (push).                      |
| H5  | Photo PII rejection (Task 42) catches the bulk of face uploads without users complaining about false rejections.                                                    | Sentry breadcrumbs from `PhotoService.upload` plus user-support email volume to `yyou017@gmail.com`.                                                    | Whether to relax the B3 threshold or add mosaic fallback (Task 42 option A). |
| H6  | Korean-only at launch is acceptable for the first cohort.                                                                                                           | App Store reviews mentioning English.                                                                                                                   | i18n scope decision (currently out of Phase 5).                              |
| H7  | Real users submit machine names absent from the 11-template launch seed at a rate that justifies an admin promotion queue rather than a one-off bulk seed.          | `unverified_machine_names` inserts per week once item 11 ships the persistence path. Compare distinct-name volume to admin curation throughput.         | Item 11 admin queue UI and the optional bulk-seed decision.                  |

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
