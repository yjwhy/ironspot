# Phase 2 — Implementation Progress

Updated automatically as tasks complete via `/commit-task` command.

## Status

Phase 2 in progress. Task 19 next.

### Pre-requisites status (2026-05-07)

- [x] Docker Desktop installed
- [x] Java 25 (Temurin 25.0.3) installed

## Task Checklist

- [x] Task 16: Spring Boot Project Setup
- [x] Task 17: JWT Auth Infrastructure
- [x] Task 18: Core Read Endpoints
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

| Task | Commit  | Date       | Notes                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---- | ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 16   | 9f03e79 | 2026-05-07 | Spring Boot 3.5.0 + Java 25 skeleton. Gradle Kotlin DSL (daemon on Java 24 — Kotlin compiler can't parse Java 25 version strings). Common layer: ApiResponse, BusinessException, GlobalExceptionHandler, OpenApiConfig. Testcontainers: postgis/postgis:17-3.5 + full schema init. HealthCheckTest green. Dockerfile + docker-compose + GitHub Actions CI. PR #27.                                                       |
| 17   | 3774503 | 2026-05-07 | Supabase JWT validation (JJWT 0.12.6, HMAC-SHA256), JwtAuthenticationFilter, SecurityConfig (stateless + 401 entry point). UserPrincipal, UserRepository (ON CONFLICT DO NOTHING), UserService (@Transactional getOrCreate/updateNickname/deleteAccount), GET/PUT/DELETE /api/users/me. 15 tests green. PR #28.                                                                                                          |
| 18   | f0f3e63 | 2026-05-07 | 6 public GET endpoints: /api/brands, /api/categories, /api/gyms/search (PostGIS ST_Within), /api/gyms/:id, /api/gyms/:id/machines, /api/machines/:gymMachineId/photos. NamedParameterJdbcTemplate + Types.VARCHAR for nullable filter params. Null-safe RowMappers. Singleton Testcontainers pattern in IntegrationTestBase. BindException handler covers both @RequestBody and @ModelAttribute. 34 tests green. PR #29. |
