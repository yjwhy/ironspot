# Phase 3 — Implementation Progress

Updated automatically as tasks complete via `/commit-task` command.

## Status

Phase 3 plan written 2026-05-13. All 11 key decisions captured in `implementation.md` "Confirmed Decisions" + Voice + UX entries. Scope: NL Search + minimum admin (Q1 = B). Cost: $0 across LLM (Groq + Gemini fallback), STT (native OS), geocoding (Naver Task 28 key), eval workflow (path-filtered, <500 calls/month), and observability (Sentry breadcrumb under 5000 events/month).

### Pre-requisites status (2026-05-13)

- [ ] Groq account + API key (no credit card — confirm signup screen doesn't require billing)
- [ ] Google Cloud Gemini API key (AI Studio path, no billing activation)
- [ ] `expo-speech-recognition` package added
- [ ] First admin user designated via SQL `UPDATE users SET role = 'admin'`
- [x] Sentry app + api projects (Task 31, live)
- [x] Naver Search API key (Task 28, live)

## Task Checklist

- [ ] Task 33: Admin role + 4 admin endpoints
- [ ] Task 34: Admin in-app screens (queue + photo detail)
- [ ] Task 35: LlmClient abstraction + DSL + prompts + snapshots
- [ ] Task 36: NL Search backend pipeline
- [ ] Task 37: Rate limit + monthly cron + auth gate + RECORD_AUDIO restoration
- [ ] Task 38: NL Search UI + voice input + interpretation chip + map mapping
- [ ] Task 39: Path-filtered eval workflow + Sentry breadcrumb
- [ ] Task 40: Phase 3 final verification + Phase 4 README

## Completed Tasks Log

_None yet — Tasks land here as they merge._

| Task | Commit | Date | Notes |
| ---- | ------ | ---- | ----- |

## Pre-Launch Backlog (status snapshot, not Phase 3 numbered Tasks)

App Store submission gates carried from Phase 2:

- [x] **Apple Sign In code** (PR #46) — `LoginScreen` iOS-only Apple button via Web OAuth pattern, deferred external wiring
- [x] **Android RECORD_AUDIO removed** (PR #47) — was correct at the time; restored in Task 37 when voice STT became a requirement
- [ ] **Apple Sign In external wiring** — Apple Developer enrollment + Service ID + Supabase Apple provider + `ios.usesAppleSignIn`
- [ ] **Privacy Policy + Terms of Service** — content + hosted URLs + App Store Connect link
- [ ] **UptimeRobot keep-warm** — optional, 5-min `/actuator/health` ping
