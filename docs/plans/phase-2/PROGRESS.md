# Phase 2 — Implementation Progress

Updated automatically as tasks complete via `/commit-task` command.

## Status

Phase 2 in progress. Task 22 next.

### Pre-requisites status (2026-05-07)

- [x] Docker Desktop installed
- [x] Java 25 (Temurin 25.0.3) installed

## Task Checklist

- [x] Task 16: Spring Boot Project Setup
- [x] Task 17: JWT Auth Infrastructure
- [x] Task 18: Core Read Endpoints
- [x] Task 19: OpenAPI Spec + Orval Client Generation
- [x] Task 20: Frontend Auth (Google/Kakao)
- [x] Task 21: Migrate Frontend Services to Spring Boot API
- [ ] Task 22: JOOQ Migration
- [ ] Task 23: Orval Type Alignment (eliminate as-unknown-as casts)
- [ ] Task 24: Photo Upload Pipeline (Backend)
- [ ] Task 25: Photo Upload UI (Frontend)
- [ ] Task 26: Upvote System
- [ ] Task 27: Report System
- [ ] Task 28: New Gym Registration (Naver Places API)
- [ ] Task 29: My Page
- [ ] Task 30: Account Settings
- [ ] Task 31: Monitoring + Sentry
- [ ] Task 32: Phase 2 Final Verification

## Completed Tasks Log

| Task | Commit  | Date       | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---- | ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 16   | 9f03e79 | 2026-05-07 | Spring Boot 3.5.0 + Java 25 skeleton. Gradle Kotlin DSL (daemon on Java 24 — Kotlin compiler can't parse Java 25 version strings). Common layer: ApiResponse, BusinessException, GlobalExceptionHandler, OpenApiConfig. Testcontainers: postgis/postgis:17-3.5 + full schema init. HealthCheckTest green. Dockerfile + docker-compose + GitHub Actions CI. PR #27.                                                                                                                                                                               |
| 17   | 3774503 | 2026-05-07 | Supabase JWT validation (JJWT 0.12.6, HMAC-SHA256), JwtAuthenticationFilter, SecurityConfig (stateless + 401 entry point). UserPrincipal, UserRepository (ON CONFLICT DO NOTHING), UserService (@Transactional getOrCreate/updateNickname/deleteAccount), GET/PUT/DELETE /api/users/me. 15 tests green. PR #28.                                                                                                                                                                                                                                  |
| 18   | f0f3e63 | 2026-05-07 | 6 public GET endpoints: /api/brands, /api/categories, /api/gyms/search (PostGIS ST_Within), /api/gyms/:id, /api/gyms/:id/machines, /api/machines/:gymMachineId/photos. NamedParameterJdbcTemplate + Types.VARCHAR for nullable filter params. Null-safe RowMappers. Singleton Testcontainers pattern in IntegrationTestBase. BindException handler covers both @RequestBody and @ModelAttribute. 34 tests green. PR #29.                                                                                                                         |
| 19   | d6639b8 | 2026-05-08 | SpecExportTest exports openapi.json from live app context. ApiResponse<T> wrapper removed — controllers return domain types directly. Orval generates TanStack Query hooks (5 tags). api-client.ts: ky + JWT injection + 401 token-refresh retry. @Schema(requiredMode=REQUIRED) on non-nullable fields, produces=APPLICATION*JSON_VALUE on all controllers, OpenApiCustomizer normalises */\_ → application/json. CI freshness check via git diff --exit-code. PR #30.                                                                          |
| 20   | c914b68 | 2026-05-08 | UserController: @Hidden → @Operation + @Tag("users"), /api/users/me included in spec. orval.config.ts filter removed, users/ client generated. useAuth (discriminated AuthState via onAuthStateChange), useRequireAuth (gate hook, sync from useAuth), LoginScreen (Google+Kakao OAuth, error toast), app/(auth)/login+callback routes. useCurrentUser moved to features/auth/hooks, userKeys factory, STALE_TIME_DEFAULT_MS exported from query-client. 301 tests green. PR #31.                                                                |
| 21   | fb504e2 | 2026-05-08 | Migrate all frontend services from Supabase direct calls to Orval-generated Spring Boot API client. Spring Boot: GymMachineResponse.photoCount → photos: List<PhotoResponse> with batch fetch in MachineService (N+1 prevention via findByGymMachineIds). Frontend: brands, categories, gym-search, gym-detail, photo-list services rewritten; toMachinePhoto deduplicated (exported from photo-list); toMachineTemplate extracted; getGymById return type narrowed to Promise<Gym>. All function signatures unchanged. 303 tests green. PR #32. |
