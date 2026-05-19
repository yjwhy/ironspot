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
