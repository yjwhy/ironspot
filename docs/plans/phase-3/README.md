# Phase 3: Natural Language Search + Minimum Admin

**Status:** Plan written 2026-05-13. See `implementation.md` for the 8-Task breakdown (Tasks 33–40).

## Scope

**Track A — Minimum admin (Tasks 33–34, ~1 week)**: Fill the Phase 2 operational gap. `users.role` enum + 4 admin endpoints (pending queue list, report disposition, photo restore, user ban) + 2 in-app screens.

**Track B — Natural Language Search (Tasks 35–39, ~3-4 weeks)**:

1. Natural language search text-to-query pipeline (Groq Llama 3.3 70B primary + Gemini 2.0 Flash fallback, both $0 free tier)
2. Rich DSL — named places, specific machine names, multi-machineFilter compose, per-filter scope (each / combined)
3. Server-side Naver Places geocoding (Task 28 key reuse)
4. Dynamic PostGIS query builder via JOOQ
5. Map top search bar with text + voice (native OS STT, $0) + recent history + interpretation chip
6. Rate limiting (100/month hard limit per user, monthly `@Scheduled` reset)
7. 3-layer test defense: snapshot fixtures + path-filtered GitHub Actions eval + Sentry breadcrumb

**Cost constraint: $0 across all infrastructure.** No credit card on any provider. See `implementation.md` "Architecture / Cost-zero infrastructure" table.

## Files in this directory

- `implementation.md` — detailed Task 33–40 breakdown with file paths, DSL schema, prompts, SQL builder pseudocode, integration test matrix
- `PROGRESS.md` — task checklist + completed log + pre-requisites status
- `CLAUDE.md` — Phase 2/3 Spring Boot conventions (re-loaded when working under `iron-spot-api/`)

## Carried over from earlier phases — deferred to Phase 4

Items originally noted in Phase 3 scope but cut per Q1 decision (Scope B). These move to `phase-4/README.md` (created in Task 40):

### From Task 27 (Report System)

- **`gym_machine` reporting** — `reports.target_type` already supports the value via DB CHECK constraint, but the controller, service, and frontend treat photo as the only target. Phase 4 needs (a) policy decision (does a "wrong machine info" report blind the machine? hide it from search?) and (b) UI entry point.
- **Reporter trust scoring + auto-ban** — current model treats every reporter as weight 1. Phase 4 should track admin disposition (`reports.status` already supports `pending`/`reviewed`/`dismissed`/`actioned`) and lower the weight of reporters whose `dismissed` rate is high. Repeat false reporters get auto-restricted from reporting. Schema: add `users.report_trust_score NUMERIC` or compute on read.
- **Standalone admin web UI** — Phase 3 ships an in-app moderator screen (Tasks 33–34) as the minimum viable admin surface. Phase 4 may promote it to a standalone web UI (Next.js) once moderation volume warrants the separate frontend build/deploy pipeline.
- **Appeal flow for false-positive auto-blinds** — currently blinded photos require admin manual restore. Phase 4 should let the original uploader request review via in-app, surfacing the appeal in the same admin queue.

### From Task 30 (Account Settings)

- **사진 PII 검열 (얼굴 / 문신 등)** — Phase 2 계정 삭제 정책은 "사진 익명화 유지" (사용자 `user_id`만 NULL, 사진 자체는 헬스장 데이터로 보존). 한국 PIPA 상 익명화 = 파기에 준하는 것으로 인정되지만, 사진에 얼굴 / 문신 등 식별정보가 들어있으면 진정한 익명화가 아닐 수 있다. Task 27의 SafeSearch는 adult / violence만 검출하고 PII는 검출하지 않는다. Phase 4 필요 작업: (a) Vision API `FACE_DETECTION` 추가 또는 별도 PII 모델 도입 결정, (b) 검출 시 자동 모자이크 vs reject 정책, (c) 기존 업로드 사진 재처리 백필 여부.
