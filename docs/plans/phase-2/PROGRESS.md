# Phase 2 — Implementation Progress

Updated automatically as tasks complete via `/commit-task` command.

## Status

Phase 2 in progress. Task 17 next.

### Pre-requisites status (2026-05-07)

- [x] Docker Desktop installed
- [x] Java 25 (Temurin 25.0.3) installed

## Task Checklist

- [x] Task 16: Spring Boot Project Setup
- [ ] Task 17: JWT Auth Infrastructure
- [ ] Task 18: Core Read Endpoints
- [ ] Task 19: OpenAPI Spec + Orval Client Generation
- [ ] Task 20: Frontend Auth (Google/Kakao)
- [ ] Task 21: Migrate Frontend Services to Spring Boot API
- [ ] Task 22: Photo Upload Pipeline (Backend)
- [ ] Task 23: Photo Upload UI (Frontend)
- [ ] Task 24: Upvote System
- [ ] Task 25: Report System
- [ ] Task 26: New Gym Registration (Naver Places API)
- [ ] Task 27: My Page
- [ ] Task 28: Account Settings
- [ ] Task 29: Monitoring + Sentry
- [ ] Task 30: Phase 2 Final Verification

## Completed Tasks Log

| Task | Commit  | Date       | Notes                                                                                                                                                                                                                                                                                                                                                              |
| ---- | ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 16   | 9f03e79 | 2026-05-07 | Spring Boot 3.5.0 + Java 25 skeleton. Gradle Kotlin DSL (daemon on Java 24 — Kotlin compiler can't parse Java 25 version strings). Common layer: ApiResponse, BusinessException, GlobalExceptionHandler, OpenApiConfig. Testcontainers: postgis/postgis:17-3.5 + full schema init. HealthCheckTest green. Dockerfile + docker-compose + GitHub Actions CI. PR #27. |
