# Phase 3 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Phase:** 3 (Natural Language Search + Minimum Admin)
**Version:** 1.0
**Date:** 2026-05-13
**Author:** YJ (builtByYJ)

## Goal

Two tracks land in Phase 3:

1. **Minimum admin tool** — Phase 2 shipped report + auto-blind + Slack alerts but no surface to actually disposition the queue. Without this, pending reports accumulate indefinitely. Admin = 4 endpoints + 2 in-app screens gated by `users.role = 'admin'`.
2. **Natural Language Search** — the headline Phase 3 feature per architecture-design.md and ADR 0011. Text-to-query pipeline: user NL → LLM → structured DSL → SQL builder (reusing Phase 2 PostGIS / brand / category infrastructure) → results on map. Plus voice input via native OS STT.

**Hard constraint: $0 operational cost.** Every infrastructure choice in Phase 3 is constrained to free tiers with no credit card on file, so paid-tier auto-upgrade is structurally impossible (rate-limit responses come back as 429, never a charge).

## Phase 2 → Phase 3 Transition Strategy

Phase 2 ended with:

- Report system writing to `reports` table + Slack alerts on auto-blind / urgent reports / safesearch-suspect uploads
- `users` table with `nickname`, `connected_email`, `deleted_at` columns
- Spring Boot 4 + Java 25 + JOOQ DSL + Testcontainers test harness
- Sentry app + api observability (Task 31)
- Render deployment with PORT=10000, `sslmode=require` Supabase pooler (Task 32b)
- 8 EAS secrets baked into preview-simulator build profile

Phase 3 adds without breaking those:

- `users.role TEXT NOT NULL DEFAULT 'user'` column with check constraint
- `users.nl_search_count_month INT NOT NULL DEFAULT 0` quota counter
- `users.nl_search_count_reset_at TIMESTAMPTZ` last reset marker (cron writes here)
- Admin endpoints under `/api/admin/**` gated by `@PreAuthorize("hasRole('ADMIN')")`
- Search endpoint `/api/search/natural` gated by `authenticated()` + per-user quota
- Frontend: `app/admin/queue.tsx`, `app/admin/photo/[id].tsx`, `(tabs)/map.tsx` 상단 검색바 + 마이크
- iOS `NSMicrophoneUsageDescription` + `NSSpeechRecognitionUsageDescription`
- Android `RECORD_AUDIO` permission (restoring what PR #47 removed — that removal was correct for then; voice input is a new requirement)

The map screen gets a new top bar but the FilterPanel + GymBottomSheet + SearchAreaButton remain unchanged. NL Search results land on the same map markers as FilterPanel results — same query layer, different input modality.

## Architecture

### Admin tool (Track A)

```
[Expo RN App — admin-role user]
     ↓  Spring Security JWT
[GET  /api/admin/reports?status=pending]      → pending queue
[PATCH /api/admin/reports/{id}]               → disposition (actioned / dismissed)
[PATCH /api/admin/photos/{id}/restore]        → is_blinded = false
[PATCH /api/admin/users/{id}/ban]             → soft ban via users.banned_at
     ↓
[Frontend: app/admin/queue.tsx]               → list pending reports
[Frontend: app/admin/photo/[id].tsx]          → detail + actions
```

Non-admin users never see admin UI (route gate via `useAuth().user.role === 'admin'`). DB role enum is the single source of truth.

### Natural Language Search (Track B)

```
User input ("강남역 1km 안에 파나타 하이로우 3개 있는 헬스장")
     ↓
[Frontend: TopSearchBar — text or 🎙 voice]
     ↓  ky POST /api/search/natural { query, userLat, userLng }
[Backend: SearchController]
     ↓
[NlSearchService.parseToDsl(query)]
     ↓
[LlmClient (interface) — GroqLlamaClient.parse(query)] ← primary
     ↓  on RATE_LIMIT / TIMEOUT / 5xx → fallback
[LlmClient — GeminiFlashClient.parse(query)]
     ↓  returns SearchDsl { location, machineFilters[], error? }
     ↓
[NlSearchService.resolveLocation(dsl, userLat, userLng)]
     ↓  if dsl.location.type == 'named_place' and !coordinates:
[NaverSearchService.searchPlaces(dsl.location.name)] (Phase 2 Task 28 service)
     ↓  inject coordinates into dsl
     ↓
[SqlBuilder.buildGymQuery(dsl)]                ← per-machineFilter EXISTS subquery
     ↓
[Database — JOOQ DSL.fetch]
     ↓  SearchResponse { gyms, interpretation, totalCount }
     ↓
[Frontend: map markers update + interpretation chip]
```

### Cost-zero infrastructure

| Component     | Choice                                                               | Free tier safety                         |
| ------------- | -------------------------------------------------------------------- | ---------------------------------------- |
| LLM primary   | Groq Llama 3.3 70B (~250 tok/s)                                      | No credit card, 30 req/min, 1000 req/day |
| LLM fallback  | Gemini 2.0 Flash                                                     | No credit card, 15 req/min, 1500 req/day |
| Voice STT     | iOS SFSpeechRecognizer + Android SpeechRecognizer                    | Native OS, no API call                   |
| Geocoding     | Naver Places (Task 28 key)                                           | Already provisioned, 25k/day             |
| Eval workflow | GitHub Actions `paths:` filter on prompt/Llm/SqlBuilder changes only | <500 calls/month, well within Groq       |
| Observability | Sentry breadcrumb (not captureException) for normal flow             | 5000 events/month free                   |

All paid tiers require explicit account upgrade with billing setup — never automatic.

## Confirmed Decisions (from grill-me 2026-05-13)

| #        | Choice                                                                                     | Rationale                                                                                                                                                                             |
| -------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1       | Scope = NL Search + minimum admin                                                          | Phase 2 operational gap (auto-blinded photos accumulating with no disposition surface) must close before adding LLM feature surface                                                   |
| Q2       | LLM = Groq Llama 3.3 70B primary + Gemini 2.0 Flash fallback                               | Speed (Groq LPU ~250 tok/s) + reliability (2-provider redundancy) + $0 free tier on both                                                                                              |
| Q3       | Product goal = rich NL (named places + specific machines + multi-machine compose)          | FilterPanel-equivalent NL would give users no reason to use NL — the value is supporting queries that FilterPanel can't express                                                       |
| Q4       | Ambiguity resolution = LLM infers `scope: 'each' \| 'combined'`                            | UX simplicity over UI clarification step; mitigation = result-page chip showing the chosen interpretation                                                                             |
| Q5       | Geocoding = LLM returns name only; server resolves via Naver Places                        | LLM coordinate hallucination is a known risk; geocoding is deterministic, doesn't need LLM                                                                                            |
| Q6       | Search UI = Map tab top search bar                                                         | NL input + map result viewing in one screen, no tab switch mental cost                                                                                                                |
| Q7       | Result presentation = map markers + interpretation chip + 0-results fallback CTA           | Markers reuse FilterPanel pattern; chip surfaces LLM's interpretation so user can sanity-check                                                                                        |
| Q8       | Auth + quota = login-required + `users.nl_search_count_month` + monthly `@Scheduled` reset | DB column survives restart; login-only ensures accurate per-user quota                                                                                                                |
| Q9       | Admin = 4 endpoints + 2 in-app screens + `users.role` enum                                 | Operational gap fix, not SaaS-grade admin tool; web UI deferrable until queue volume warrants                                                                                         |
| Q10      | Phasing = Admin first (Task 33-34, ~1 week) → NL Search (Task 35-39, ~3-4 weeks)           | Close operational gap before adding new LLM surface that could itself need admin intervention                                                                                         |
| Q11      | LLM tests = 3-layer defense (snapshot + path-filtered eval + Sentry breadcrumb)            | $0 (snapshot record once, path-filter keeps eval under 500/month, Sentry within 5000 events) + solid (PR-time regression catch via path filter, prod regression catch via breadcrumb) |
| Voice    | iOS SFSpeechRecognizer + Android SpeechRecognizer via expo-speech-recognition              | $0 native; restores RECORD_AUDIO + iOS plist permission strings (intentional reversal of PR #47, which was correct at the time)                                                       |
| Voice UX | Tap to toggle + auto-stop on 1s silence + STT result fills input box + no auto-search      | STT misrecognition (Korean homophones) requires user-confirmation step before search fires                                                                                            |

## Pre-requisites (gates — note which task each blocks)

- [ ] **Groq account** with API key — blocks Task 35 (no credit card; sign up at console.groq.com, confirm no billing setup screen appears during signup)
- [ ] **Google Cloud Gemini API key** — blocks Task 35 (Gemini API in AI Studio at aistudio.google.com; confirm "Get API key" path without billing activation)
- [ ] **`expo-speech-recognition` package** + plist + manifest entries — blocks Task 38
- [ ] **First admin user designation** — Phase 3 launches without an admin UI to promote users, so the founding admin is set via direct SQL: `UPDATE users SET role = 'admin' WHERE id = '<your-user-id>'`. This unblocks Task 34 verification (need an admin account to load admin screens).
- [ ] **Sentry app + api projects** (Task 31) confirmed live — Phase 3 reuses for NL Search breadcrumb. No new project needed.
- [ ] **Naver Search API key** (Task 28) confirmed live — Phase 3 reuses for geocoding. No new key needed.

## Out-of-scope for Phase 3 (carry-over to Phase 4 or post-launch)

Items in `phase-3/README.md` that are explicitly deferred per Q1 (Scope B):

- Photo PII detection (Vision API FACE_DETECTION + mosaic vs reject policy + backfill)
- Reporter trust scoring + auto-ban (`users.report_trust_score` or computed on read)
- Appeal flow for false-positive auto-blinds (in-app surface for blinded uploaders)
- `gym_machine` target type for reports (currently `target_type = 'photo'` only at the controller layer)
- Standalone admin web UI (Next.js separate frontend) — defer until queue volume warrants
- Caching of duplicate NL queries — defer until measured to be worth the cache invalidation complexity

These are tracked in `phase-4/README.md` (to be created at Phase 3 close).

---

## Task 33: Admin role + 4 admin endpoints (Backend)

**Goal:** Backend admin surface — `users.role` enum, `users.banned_at` soft-ban column, 4 endpoints gated by `hasRole('ADMIN')`. No frontend work in this task.

**What must be complete before calling this task done:**

- Migration adds `users.role TEXT NOT NULL DEFAULT 'user'` with CHECK constraint and `users.banned_at TIMESTAMPTZ`
- `JwtAuthenticationFilter` (Task 17) reads `role` from `users` row at session-load and propagates `ROLE_ADMIN` authority
- 4 endpoints: GET `/api/admin/reports`, PATCH `/api/admin/reports/{id}`, PATCH `/api/admin/photos/{id}/restore`, PATCH `/api/admin/users/{id}/ban`
- All 4 return 403 for non-admin authenticated users, 401 for anonymous
- Integration tests with `IntegrationTestBase` + admin/non-admin/anonymous matrix per endpoint
- OpenAPI regenerated, Orval client picks up new endpoints

**Files to create / change:**

```
iron-spot-api/src/main/resources/db/migration/V20260514__add_user_role_and_ban.sql
iron-spot-api/src/main/java/com/ironspot/auth/UserPrincipal.java                (modify — add role)
iron-spot-api/src/main/java/com/ironspot/auth/JwtAuthenticationFilter.java     (modify — propagate ROLE_ADMIN)
iron-spot-api/src/main/java/com/ironspot/auth/SecurityConfig.java              (modify — @EnableMethodSecurity)
iron-spot-api/src/main/java/com/ironspot/admin/AdminController.java            (new)
iron-spot-api/src/main/java/com/ironspot/admin/AdminService.java               (new)
iron-spot-api/src/main/java/com/ironspot/admin/dto/AdminReportResponse.java    (new)
iron-spot-api/src/main/java/com/ironspot/admin/dto/DispositionRequest.java     (new)
iron-spot-api/src/main/java/com/ironspot/admin/dto/BanRequest.java             (new)
iron-spot-api/src/main/java/com/ironspot/user/UserService.java                 (modify — getOrCreate writes role='user', expose markBanned)
iron-spot-api/src/main/java/com/ironspot/report/ReportRepository.java          (modify — findByStatusOrderByCreatedAtDesc, updateStatus)
iron-spot-api/src/main/java/com/ironspot/photo/MachinePhotoRepository.java     (modify — markRestored)
iron-spot-api/src/test/java/com/ironspot/admin/AdminControllerIT.java          (new)
```

### Step 1: Migration

```sql
-- V20260514__add_user_role_and_ban.sql
ALTER TABLE users
  ADD COLUMN role TEXT NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'admin')),
  ADD COLUMN banned_at TIMESTAMPTZ;

COMMENT ON COLUMN users.role IS 'Authorization role. Promote via direct SQL until admin UI exists.';
COMMENT ON COLUMN users.banned_at IS 'Soft ban marker. Non-null = denied at JwtAuthenticationFilter.';

CREATE INDEX idx_users_role ON users(role) WHERE role = 'admin';
```

### Step 2: Propagate role in `JwtAuthenticationFilter`

The filter currently calls `userService.getOrCreate(claims)` and constructs `UserPrincipal(id, email, nickname)`. Extend:

```java
// UserPrincipal.java
public record UserPrincipal(UUID id, String email, String nickname, String role, Instant bannedAt) {
    public boolean isBanned() { return bannedAt != null; }
    public Collection<GrantedAuthority> authorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role.toUpperCase()));
    }
}

// JwtAuthenticationFilter.java — after getOrCreate:
if (principal.isBanned()) {
    response.setStatus(HttpServletResponse.SC_FORBIDDEN);
    response.getWriter().write("{\"error\":\"banned\"}");
    return;
}
UsernamePasswordAuthenticationToken auth =
    new UsernamePasswordAuthenticationToken(principal, null, principal.authorities());
SecurityContextHolder.getContext().setAuthentication(auth);
```

### Step 3: `SecurityConfig` — enable method security + admin path matchers

```java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity  // unlocks @PreAuthorize("hasRole('ADMIN')")
public class SecurityConfig {
    // ... existing chain ...
    // /api/admin/** is implicitly covered by authenticated() + @PreAuthorize on controller
}
```

### Step 4: `AdminController`

```java
@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "admin", description = "Admin-only moderation surface")
public class AdminController {
    private final AdminService adminService;

    @GetMapping("/reports")
    public List<AdminReportResponse> listPendingReports(
        @RequestParam(defaultValue = "pending") String status,
        @RequestParam(defaultValue = "50") int limit
    ) {
        return adminService.listReports(status, limit);
    }

    @PatchMapping("/reports/{id}")
    public AdminReportResponse disposition(
        @PathVariable UUID id,
        @Valid @RequestBody DispositionRequest req,
        @AuthenticationPrincipal UserPrincipal admin
    ) {
        return adminService.disposeReport(id, req.disposition(), admin.id());
    }

    @PatchMapping("/photos/{id}/restore")
    public void restorePhoto(@PathVariable UUID id) {
        adminService.restorePhoto(id);
    }

    @PatchMapping("/users/{id}/ban")
    public void banUser(
        @PathVariable UUID id,
        @Valid @RequestBody BanRequest req
    ) {
        adminService.banUser(id, req.reason());
    }
}
```

### Step 5: `AdminService` — JOOQ updates

`AdminService.disposeReport`: update `reports.status = 'actioned' | 'dismissed'`, `reports.disposed_by = admin_id`, `reports.disposed_at = now()`. Wrap in `@Transactional`.

`AdminService.restorePhoto`: update `machine_photos.is_blinded = false`. (No undo path — re-blinding requires another report cycle.)

`AdminService.banUser`: set `users.banned_at = now()`. (No reason column for now; if a reason is wanted in audit, add `users.banned_reason TEXT` in a follow-up.)

### Step 6: Integration tests

`AdminControllerIT extends IntegrationTestBase`. Matrix per endpoint: (admin, regular_user, anonymous). Use `IntegrationTestBase` JWT helpers to mint a token with explicit role claim. Verify:

- Admin → 200 + correct effect (DB row updated)
- Regular user → 403
- Anonymous → 401
- Already-disposed report → 409 (`BusinessException`)
- Non-existent UUID → 404

### Step 7: OpenAPI export

`SpecExportTest` (Task 19) regenerates `openapi.json`. CI freshness check (already in place) will fail until the file is committed.

### Commit

```
feat(phase-3): 33 — admin role + 4 admin endpoints

- Migration: users.role enum + users.banned_at + idx_users_role partial index.
- UserPrincipal carries role + banned_at. JwtAuthenticationFilter denies banned
  sessions at 403, propagates ROLE_ADMIN authority for admin role.
- AdminController: GET /admin/reports + PATCH /admin/reports/{id} +
  PATCH /admin/photos/{id}/restore + PATCH /admin/users/{id}/ban.
  All gated by @PreAuthorize("hasRole('ADMIN')").
- SecurityConfig: @EnableMethodSecurity. /api/admin/** stays under
  anyRequest().authenticated() — method-level annotation does role check.
- AdminControllerIT: admin/user/anonymous matrix per endpoint. 24 cases.
- OpenAPI regenerated. Orval picks up adminApi.* client functions.
```

---

## Task 34: Admin in-app screens (Frontend)

**Goal:** Two screens — admin queue list and admin photo detail. Gated at the route level by `useAuth().status === 'authenticated' && user.role === 'admin'`. Non-admin authenticated users get an empty state; anonymous users get redirected to login.

**Carried in from Task 33 (gap):** Task 33's plan said `UserResponse` DTO would include `role` as a consequence of adding the column, but the PR shipped without modifying the DTO. Task 34 absorbs this as Step 0 (backend prereq) so the frontend `user.role === 'admin'` check has data to read.

**What must be complete before calling this task done:**

- `UserResponse.java` exposes `role` (Step 0 prereq absorbed from Task 33)
- `app/admin/queue.tsx` lists pending reports, taps navigate to detail
- `app/admin/photo/[id].tsx` shows the reported photo + action buttons (dispose actioned / dismissed / restore photo / ban user)
- Non-admin authenticated visit shows "권한이 없습니다" empty state, not a 404 or a blank screen
- All admin actions go through TanStack Query mutations with optimistic invalidation of `adminKeys.pendingReports()`
- `users.role` propagates through `useCurrentUser` so the role check works
- 6+ frontend tests covering route gating, action dispatch, optimistic update

**Files to create / change:**

```
iron-spot-api/src/main/java/com/ironspot/auth/dto/UserResponse.java   (modify — add role field)
iron-spot-api/src/main/java/com/ironspot/auth/UserRepository.java     (modify — SELECT USERS.ROLE in findById)
iron-spot-api/src/test/java/com/ironspot/auth/MyContentTest.java      (modify — assert role in /me response)
openapi.json                                                          (regen — UserResponse schema gains role)
src/shared/generated/model/userResponse.ts                            (regen — orval picks up role)
src/features/admin/routes.ts                                          (new)
src/features/admin/query-keys.ts                                      (new)
src/features/admin/hooks/useAdminReports.ts                           (new)
src/features/admin/hooks/useDisposeReport.ts                          (new)
src/features/admin/hooks/useRestorePhoto.ts                           (new)
src/features/admin/hooks/useBanUser.ts                                (new)
src/features/admin/components/AdminQueueScreen.tsx                    (new)
src/features/admin/components/AdminPhotoScreen.tsx                    (new)
src/features/admin/components/AdminGuard.tsx                          (new — route gate)
src/features/admin/components/__tests__/...                           (new — 6 tests minimum)
app/admin/_layout.tsx                                                 (new)
app/admin/queue.tsx                                                   (new — re-export)
app/admin/photo/[id].tsx                                              (new — re-export)
src/features/auth/hooks/useCurrentUser.ts                             (no change needed — type updates via orval regen)
```

### Step 0 (prereq): Surface `role` to the GET /me response

`UserResponse.java` gains `String role;` field. `UserRepository.findById` adds `USERS.ROLE` to the SELECT list and to the `UserResponse.builder()` chain. `MyContentTest` is extended to assert the role is present in the response body (default `"user"` for the seeded test user). Re-run `SpecExportTest` so `openapi.json` regenerates; run `pnpm generate:api` so the orval `UserResponse` type gains `role?: string`. Without this step the frontend `AdminGuard` cannot distinguish admin from regular user — every authenticated visitor would hit the "권한이 없습니다" empty state regardless of their actual role.

### Step 1: `AdminGuard` — route gate

```tsx
// AdminGuard.tsx
export function AdminGuard({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const { data: user } = useCurrentUser();

  if (auth.status !== 'authenticated') return <LoginPromptEmptyState />;
  if (user?.role !== 'admin') return <EmptyState title="권한이 없습니다" />;
  return <>{children}</>;
}
```

`app/admin/_layout.tsx` wraps every admin route in `AdminGuard`.

### Step 2: `useAdminReports` — pending queue hook

```tsx
export function useAdminReports() {
  return useQuery({
    queryKey: adminKeys.pendingReports(),
    queryFn: () =>
      unwrapOrvalResponse(adminApi.useGetAdminReports({ status: 'pending', limit: 50 })),
    staleTime: STALE_TIME_DEFAULT_MS,
  });
}
```

### Step 3: Mutation hooks

`useDisposeReport(reportId)`: TanStack mutation, invalidates `adminKeys.pendingReports()` + `adminKeys.report(reportId)` on success. Optimistic remove from list on `pending → actioned/dismissed`.

`useRestorePhoto(photoId)`: mutation, invalidates `photoKeys.detail(photoId)`. Optimistic `is_blinded: false` in cache.

`useBanUser(userId)`: mutation, invalidates `userKeys.profile(userId)`. Confirmation `Alert.alert` before fire (matches Task 30 pattern for destructive actions).

### Step 4: `AdminQueueScreen`

FlashList with `estimatedItemSize`, each row showing reporter avatar / 신고 사유 / target preview / 시간 경과. Tap → `router.push(\`/admin/photo/\${report.targetId}\`)`. Empty state when list is empty: "처리 대기 신고 없음".

### Step 5: `AdminPhotoScreen`

Photo preview, reporter list (all reports against this photo), reason breakdown, 4 action buttons:

- **처리 (Actioned)** — `useDisposeReport(reportId).mutate({ disposition: 'actioned' })`
- **반려 (Dismissed)** — `useDisposeReport(reportId).mutate({ disposition: 'dismissed' })`
- **사진 복구** — `useRestorePhoto(photoId).mutate()` (only when `photo.isBlinded`)
- **업로더 차단** — `useBanUser(uploaderId).mutate()` with `Alert.alert` confirm

After action, `router.back()` to queue.

### Step 6: Tests

- Anonymous renders `LoginPromptEmptyState`
- Authenticated non-admin renders "권한이 없습니다"
- Admin user sees queue with mocked reports
- Tap queue item navigates to photo detail
- Disposition mutation fires with correct args
- Ban shows `Alert.alert` confirm; cancel doesn't fire mutation

### Commit

```
feat(phase-3): 34 — admin in-app screens (queue + photo detail)

- AdminGuard route gate: anonymous → LoginPromptEmptyState, non-admin
  authenticated → "권한이 없습니다" empty state, admin → render children.
- AdminQueueScreen: FlashList of pending reports, tap navigates to detail.
- AdminPhotoScreen: photo + reporter list + 4 actions (actioned /
  dismissed / restore / ban). Ban uses Alert.alert confirm (Task 30 pattern).
- adminKeys factory, 4 mutation hooks with optimistic invalidation.
- UserResponse now carries `role` — useCurrentUser exposes it to gate.
- 6 admin tests + 408 → 414 frontend tests green.
```

---

## Task 35: LlmClient abstraction + DSL types + prompts + snapshot fixtures (Backend)

**Goal:** Backend abstraction for LLM provider with Groq primary and Gemini fallback. Defines `SearchDsl` Java records, the system prompt, and a one-time snapshot record script that generates `test/fixtures/llm-responses/*.json` from real Groq calls. This task does NOT wire LlmClient to a controller yet — Task 36 does. Isolating the abstraction makes the fallback chain unit-testable without touching HTTP.

**What must be complete before calling this task done:**

- `LlmClient` interface + `GroqLlamaClient` + `GeminiFlashClient` + `FallbackLlmClient` composite
- `SearchDsl` record matches the rich-NL schema (Q3) — location.type union + machineFilters[] + scope per filter + error
- System prompt + few-shot examples in `src/main/resources/prompts/search-dsl.md`
- `recordEvalSnapshots` Gradle task — one-time runner that calls real Groq with 30+ NL queries and writes JSON fixtures
- `LlmClientFallbackTest` unit test (no HTTP) proves: primary success → return; primary 429 → fallback succeeds; both fail → BusinessException
- Snapshot fixtures committed to `src/test/resources/llm-snapshots/`

**Files to create:**

```
iron-spot-api/src/main/java/com/ironspot/search/llm/LlmClient.java                  (interface)
iron-spot-api/src/main/java/com/ironspot/search/llm/GroqLlamaClient.java            (primary)
iron-spot-api/src/main/java/com/ironspot/search/llm/GeminiFlashClient.java          (fallback)
iron-spot-api/src/main/java/com/ironspot/search/llm/FallbackLlmClient.java          (composite)
iron-spot-api/src/main/java/com/ironspot/search/llm/LlmClientConfig.java            (WebClient beans)
iron-spot-api/src/main/java/com/ironspot/search/dsl/SearchDsl.java                  (record)
iron-spot-api/src/main/java/com/ironspot/search/dsl/Location.java                   (record / sealed)
iron-spot-api/src/main/java/com/ironspot/search/dsl/MachineFilter.java              (record)
iron-spot-api/src/main/java/com/ironspot/search/dsl/SearchScope.java                (enum)
iron-spot-api/src/main/resources/prompts/search-dsl.md                              (system prompt)
iron-spot-api/src/test/java/com/ironspot/search/llm/LlmClientFallbackTest.java      (unit)
iron-spot-api/src/test/resources/llm-snapshots/*.json                               (~30 fixtures)
iron-spot-api/buildSrc or build.gradle.kts                                          (modify — recordEvalSnapshots task)
.env.example                                                                        (modify — GROQ_API_KEY, GEMINI_API_KEY)
```

### Step 1: DSL types

```java
// SearchDsl.java
public record SearchDsl(
    Location location,
    List<MachineFilter> machineFilters,
    String error  // non-null only when LLM rejected the input
) {}

// Location.java — sealed for type safety
public sealed interface Location permits Location.Current, Location.NamedPlace {
    double radiusKm();
    record Current(double radiusKm) implements Location {}
    record NamedPlace(String name, Coordinates coordinates, double radiusKm) implements Location {
        // coordinates is null when LLM returns, filled by NaverSearchService later
    }
}

// MachineFilter.java
public record MachineFilter(
    String brand,         // nullable — slug match against brands table
    String machineName,   // nullable — fuzzy match against machine_templates
    String category,      // nullable — slug match against categories
    int minCount,
    SearchScope scope     // each | combined — LLM decides (Q4)
) {}

public enum SearchScope { EACH, COMBINED }
```

### Step 2: `LlmClient` interface

```java
public interface LlmClient {
    SearchDsl parse(String userQuery) throws LlmException;
}

public class LlmException extends RuntimeException {
    public enum Kind { RATE_LIMIT, TIMEOUT, INVALID_RESPONSE, TRANSPORT }
    private final Kind kind;
    // ...
}
```

### Step 3: `GroqLlamaClient`

WebClient call to `https://api.groq.com/openai/v1/chat/completions` (Groq is OpenAI-compatible).

```java
Map<String, Object> body = Map.of(
    "model", "llama-3.3-70b-versatile",
    "messages", List.of(
        Map.of("role", "system", "content", systemPrompt),
        Map.of("role", "user", "content", userQuery)
    ),
    "response_format", Map.of("type", "json_object"),
    "temperature", 0.0  // deterministic structured output
);
```

Map 429 → `LlmException(RATE_LIMIT)`. Map timeout → `LlmException(TIMEOUT)`. Parse `choices[0].message.content` as JSON → `SearchDsl` via Jackson. Catch `JsonProcessingException` → `LlmException(INVALID_RESPONSE)`.

### Step 4: `GeminiFlashClient`

WebClient call to `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`. Different request shape but same `SearchDsl` parse target. `responseMimeType: application/json` + `responseSchema: <SearchDsl JSON schema>` for strict validation.

### Step 5: `FallbackLlmClient` composite

```java
@Component
public class FallbackLlmClient implements LlmClient {
    private final LlmClient primary;   // GroqLlamaClient
    private final LlmClient fallback;  // GeminiFlashClient

    @Override
    public SearchDsl parse(String userQuery) {
        try {
            return primary.parse(userQuery);
        } catch (LlmException e) {
            if (e.kind() == RATE_LIMIT || e.kind() == TIMEOUT || e.kind() == TRANSPORT) {
                log.warn("primary LLM failed, falling back", e);
                Sentry.addBreadcrumb(...);
                return fallback.parse(userQuery);
            }
            throw e;  // INVALID_RESPONSE propagates — fallback won't help with prompt issues
        }
    }
}
```

### Step 6: System prompt

`src/main/resources/prompts/search-dsl.md` — full system prompt with:

- Schema description (location.type, machineFilters[] fields)
- Brand enum values (queried at app startup, injected into prompt)
- Category enum values (same)
- 8-10 few-shot examples covering: current-location + radius, named place + radius, single brand + minCount, multiple machineFilters with each scope, multiple with combined scope, error case ("커피숍 위치" → `error: 'gym search only'`)
- Output constraint: "Respond with valid JSON only. No prose."

### Step 7: `recordEvalSnapshots` Gradle task

```kotlin
tasks.register<JavaExec>("recordEvalSnapshots") {
    mainClass.set("com.ironspot.search.llm.SnapshotRecorder")
    classpath = sourceSets["test"].runtimeClasspath
    systemProperty("GROQ_API_KEY", System.getenv("GROQ_API_KEY"))
}
```

`SnapshotRecorder` (test source, but invocable as main) reads `src/test/resources/llm-snapshots/queries.txt` (30+ queries one per line), calls real Groq, writes each response as `<sanitized-query>.json`. Run once per prompt change, snapshots become fixtures for non-LLM unit tests.

### Step 8: `LlmClientFallbackTest`

```java
@Test
void primary_success_returns_primary_result() {
    when(primary.parse("...")).thenReturn(validDsl);
    SearchDsl result = composite.parse("...");
    verify(fallback, never()).parse(any());
}

@Test
void primary_rate_limit_falls_back_to_secondary() {
    when(primary.parse("...")).thenThrow(new LlmException(RATE_LIMIT));
    when(fallback.parse("...")).thenReturn(validDsl);
    SearchDsl result = composite.parse("...");
    assertEquals(validDsl, result);
}

@Test
void invalid_response_does_not_fall_back() {
    when(primary.parse("...")).thenThrow(new LlmException(INVALID_RESPONSE));
    assertThrows(LlmException.class, () -> composite.parse("..."));
    verify(fallback, never()).parse(any());
}
```

### Commit

```
feat(phase-3): 35 — LlmClient abstraction + DSL types + prompts + snapshots

- SearchDsl record + sealed Location + MachineFilter + SearchScope enum.
- LlmClient interface + GroqLlamaClient (OpenAI-compat /v1/chat/completions,
  response_format json_object, temperature 0) + GeminiFlashClient (responseSchema
  for strict validation) + FallbackLlmClient (primary 429/timeout → fallback,
  invalid response propagates without fallback).
- prompts/search-dsl.md: schema + brand/category enum injection + 10 few-shot
  examples (current/named-place location, single/multi machineFilter, each/combined
  scope, error case).
- recordEvalSnapshots Gradle task: calls real Groq with 30+ queries, writes
  fixtures to llm-snapshots/. One-time per prompt change.
- LlmClientFallbackTest: unit-only fallback semantics, no HTTP.
```

---

## Task 36: NL Search backend pipeline (Controller + Service + SqlBuilder)

**Goal:** Wire LlmClient (Task 35) + Naver geocoding (Task 28) + JOOQ SQL builder into a single endpoint. `POST /api/search/natural` accepts `{ query, userLat, userLng }`, returns `{ gyms, interpretation, totalCount }`. Authenticated only.

**What must be complete before calling this task done:**

- `POST /api/search/natural` returns `SearchResponse` with: gyms array (same shape as `/api/gyms/search`), interpretation chip text (e.g. "강남역 1km 안 / 파나타 하이로우 3개 each + 프라임 3개 each"), totalCount
- `SqlBuilder` composes per-machineFilter EXISTS subqueries (scope=each) or single GROUP BY + HAVING SUM (scope=combined)
- Server resolves `Location.NamedPlace.coordinates` via `NaverSearchService` when LLM returns name without coords
- Brand / category / machine name strings from LLM are validated against DB enums; unknown strings → 400 with helpful message
- Integration tests with Testcontainers cover: current location + single machineFilter, named place geocoding, each scope, combined scope, unknown brand → 400, LLM error → 502, parsing failure → 400
- Sentry breadcrumb on every call with `{input, dsl, totalCount, durationMs}`

**Files to create / change:**

```
iron-spot-api/src/main/java/com/ironspot/search/SearchController.java               (new)
iron-spot-api/src/main/java/com/ironspot/search/NlSearchService.java                (new)
iron-spot-api/src/main/java/com/ironspot/search/SqlBuilder.java                     (new)
iron-spot-api/src/main/java/com/ironspot/search/DslValidator.java                   (new)
iron-spot-api/src/main/java/com/ironspot/search/InterpretationFormatter.java        (new)
iron-spot-api/src/main/java/com/ironspot/search/dto/NlSearchRequest.java            (new)
iron-spot-api/src/main/java/com/ironspot/search/dto/NlSearchResponse.java           (new)
iron-spot-api/src/main/java/com/ironspot/gym/NaverSearchService.java                (modify — expose top-1 geocode helper if not already)
iron-spot-api/src/test/java/com/ironspot/search/NlSearchControllerIT.java           (new)
```

### Step 1: Request / Response DTOs

```java
public record NlSearchRequest(
    @NotBlank @Size(max = 200) String query,
    @NotNull Double userLat,
    @NotNull Double userLng
) {}

public record NlSearchResponse(
    List<GymSearchResult> gyms,
    String interpretation,
    int totalCount
) {}
```

`GymSearchResult` reuses the existing `/api/gyms/search` row shape (Phase 2 Task 18) so the frontend map markers don't need a separate DTO.

### Step 2: `SearchController`

```java
@PostMapping("/search/natural")
public NlSearchResponse search(
    @Valid @RequestBody NlSearchRequest req,
    @AuthenticationPrincipal UserPrincipal user
) {
    return nlSearchService.search(req, user);
}
```

Note: the rate-limit quota check is in Task 37 — this task just gets the pipeline wired. For Task 36 the endpoint accepts unlimited calls (will be locked down in Task 37 before merge).

### Step 3: `NlSearchService.search`

```java
@Transactional(readOnly = true)
public NlSearchResponse search(NlSearchRequest req, UserPrincipal user) {
    long start = System.nanoTime();

    SearchDsl dsl = llmClient.parse(req.query());
    if (dsl.error() != null) {
        throw new BusinessException(HttpStatus.BAD_REQUEST, dsl.error());
    }

    dslValidator.validate(dsl);  // brand/category exist + machineName fuzzy-matchable

    SearchDsl resolved = locationResolver.resolve(dsl, req.userLat(), req.userLng());
    List<GymSearchResult> gyms = sqlBuilder.execute(resolved);

    String interpretation = interpretationFormatter.format(resolved);
    long durationMs = (System.nanoTime() - start) / 1_000_000;

    Sentry.addBreadcrumb(/* { input, dsl, totalCount, durationMs } */);
    return new NlSearchResponse(gyms, interpretation, gyms.size());
}
```

### Step 4: `DslValidator`

For each `MachineFilter`:

- If `brand` non-null → must exist in `brands.slug`
- If `category` non-null → must exist in `categories.slug`
- If `machineName` non-null → fuzzy-match (Jaccard >= 0.25 from Task 24 `FuzzyMatchService`) against `machine_templates.display_name`; resolve to a list of template IDs
- `minCount >= 1`

If `brand` is given but no `brands.slug` matches → `BusinessException("'{brand}' 브랜드는 등록되지 않았어요. (예: 파나타, 테크노짐)")`. Same pattern for category.

For machine name, fuzzy match resolves the LLM's freeform text ("하이로우", "high row") to actual `machine_templates` row IDs. If 0 matches → BusinessException; if 1+ matches → store the resolved template ID list inline.

### Step 5: `SqlBuilder.execute`

Pseudocode (JOOQ DSL):

```java
SelectConditionStep<?> q = jooq.select(GYMS.fields()).from(GYMS)
    .where(condition("ST_DWithin(gyms.location, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography, ?)",
           dsl.location.coordinates().lng(), dsl.location.coordinates().lat(),
           dsl.location.radiusKm() * 1000));

if (allFiltersUseEach(dsl)) {
    for (MachineFilter f : dsl.machineFilters()) {
        q = q.and(DSL.exists(
            jooq.selectOne()
                .from(GYM_MACHINES)
                .where(GYM_MACHINES.GYM_ID.eq(GYMS.ID))
                .and(matchesFilter(f))
                .groupBy(GYM_MACHINES.GYM_ID)
                .having(DSL.count().ge(f.minCount()))
        ));
    }
} else {
    // combined scope: single subquery summing matches across all filters
    int totalMinCount = dsl.machineFilters().stream().mapToInt(MachineFilter::minCount).sum();
    Condition combinedMatch = dsl.machineFilters().stream()
        .map(this::matchesFilter)
        .reduce(Condition::or)
        .orElseThrow();
    q = q.and(DSL.exists(
        jooq.selectOne().from(GYM_MACHINES)
            .where(GYM_MACHINES.GYM_ID.eq(GYMS.ID))
            .and(combinedMatch)
            .groupBy(GYM_MACHINES.GYM_ID)
            .having(DSL.count().ge(totalMinCount))
    ));
}

return q.orderBy(distanceFrom(dsl.location)).limit(50).fetch(...);
```

`matchesFilter` builds a `Condition` combining brand match (JOIN brands by slug), category match (JOIN categories), and machine_template_id IN clause based on what's non-null in the filter.

### Step 6: `InterpretationFormatter`

```java
public String format(SearchDsl dsl) {
    String loc = switch (dsl.location()) {
        case Location.Current c -> "내 위치 " + c.radiusKm() + "km 안";
        case Location.NamedPlace n -> n.name() + " " + n.radiusKm() + "km 안";
    };
    String filters = dsl.machineFilters().stream()
        .map(this::formatFilter)
        .collect(joining(dsl.machineFilters().get(0).scope() == COMBINED ? " 또는 " : " + "));
    return loc + " / " + filters;
}

private String formatFilter(MachineFilter f) {
    StringBuilder sb = new StringBuilder();
    if (f.brand() != null) sb.append(brandDisplayName(f.brand())).append(' ');
    if (f.machineName() != null) sb.append(f.machineName()).append(' ');
    sb.append(f.minCount()).append('개');
    sb.append(f.scope() == COMBINED ? " 합쳐서" : " each");
    return sb.toString().trim();
}
```

### Step 7: Integration tests

`NlSearchControllerIT extends IntegrationTestBase`. Stub `LlmClient` via `@MockBean` (so tests are deterministic — no real LLM call). Verify:

- Happy path: stubbed DSL returns 5 matching gyms + correct interpretation
- Named place geocoding: stubbed DSL with NamedPlace + null coords → service calls Naver mock → coords filled → SQL runs
- Unknown brand: stubbed DSL with `brand: 'unknown-co'` → 400 with helpful message
- LLM error: stub throws `LlmException(RATE_LIMIT)` after fallback also throws → 502
- DSL parse error: stub returns `SearchDsl(_, _, error: 'gym search only')` → 400
- Anonymous request → 401

### Commit

```
feat(phase-3): 36 — NL Search backend pipeline

- SearchController POST /search/natural (authenticated). NlSearchService composes
  LlmClient.parse → DslValidator (brand/category exist, machineName fuzzy-matches)
  → LocationResolver (NaverSearchService for named places) → SqlBuilder (per-filter
  EXISTS for scope=each, single GROUP BY + HAVING for scope=combined) →
  InterpretationFormatter (chip text).
- DTO NlSearchRequest validation: @NotBlank query @Size(200), @NotNull lat/lng.
- GymSearchResult reused from Task 18 so frontend marker shape unchanged.
- Sentry breadcrumb per call with input/dsl/totalCount/durationMs.
- NlSearchControllerIT: 7 cases (happy/named-place/unknown-brand/LLM-error/
  parse-error/anonymous/combined-scope) with stubbed LlmClient.
- Rate-limit gate intentionally NOT added in this task — Task 37 wires it before
  merge to main.
```

---

## Task 37: Rate limit + monthly cron + auth gate + RECORD_AUDIO restoration

**Goal:** Per-user 100/month quota enforced on `/api/search/natural`. Monthly reset via `@Scheduled`. Anonymous users blocked. Reverse PR #47 enough to enable voice STT (Android RECORD_AUDIO + iOS plist entries) — voice UI itself lands in Task 38.

**What must be complete before calling this task done:**

- `users.nl_search_count_month INT NOT NULL DEFAULT 0` + `users.nl_search_count_reset_at TIMESTAMPTZ`
- `NlSearchService.search` increments `nl_search_count_month` atomically before LLM call; returns 429 + helpful error when current count >= 100
- `@Scheduled(cron = "0 0 0 1 * *")` resets all users' counter on the 1st of each month at 00:00 KST
- SecurityConfig requires authentication on `/api/search/natural`
- `app.json` android.permissions has `RECORD_AUDIO` restored; ios entries added: `NSMicrophoneUsageDescription` + `NSSpeechRecognitionUsageDescription` with clear Korean strings
- Integration tests: 99 calls succeed, 100th returns 429; after manual reset, 1st call succeeds; anonymous returns 401

**Files to create / change:**

```
iron-spot-api/src/main/resources/db/migration/V20260520__add_nl_search_quota.sql              (new)
iron-spot-api/src/main/java/com/ironspot/search/NlSearchQuotaService.java                     (new)
iron-spot-api/src/main/java/com/ironspot/search/NlSearchQuotaResetJob.java                    (new)
iron-spot-api/src/main/java/com/ironspot/search/NlSearchService.java                          (modify — call quota.checkAndIncrement)
iron-spot-api/src/main/java/com/ironspot/auth/SecurityConfig.java                             (modify — /search/natural requires auth)
iron-spot-api/src/test/java/com/ironspot/search/NlSearchQuotaServiceIT.java                   (new)
iron-spot-api/src/test/java/com/ironspot/search/NlSearchQuotaResetJobIT.java                  (new)
app.json                                                                                     (modify)
```

### Step 1: Migration

```sql
-- V20260520__add_nl_search_quota.sql
ALTER TABLE users
  ADD COLUMN nl_search_count_month INT NOT NULL DEFAULT 0,
  ADD COLUMN nl_search_count_reset_at TIMESTAMPTZ;

COMMENT ON COLUMN users.nl_search_count_month IS
  'NL Search calls in current month. Reset by @Scheduled job on 1st of month.';
```

### Step 2: `NlSearchQuotaService`

```java
@Service
public class NlSearchQuotaService {
    private static final int MONTHLY_LIMIT = 100;
    private final DSLContext jooq;

    @Transactional
    public void checkAndIncrement(UUID userId) {
        int updated = jooq.update(USERS)
            .set(USERS.NL_SEARCH_COUNT_MONTH, USERS.NL_SEARCH_COUNT_MONTH.plus(1))
            .where(USERS.ID.eq(userId))
            .and(USERS.NL_SEARCH_COUNT_MONTH.lt(MONTHLY_LIMIT))
            .execute();
        if (updated == 0) {
            throw new BusinessException(HttpStatus.TOO_MANY_REQUESTS,
                "이번 달 자연어 검색 한도를 모두 사용했어요. 다음 달 1일에 초기화됩니다.");
        }
    }
}
```

Atomic update-with-condition avoids race when two concurrent requests both read 99 and both write 100.

### Step 3: `NlSearchService.search` wires quota

```java
public NlSearchResponse search(NlSearchRequest req, UserPrincipal user) {
    quotaService.checkAndIncrement(user.id());  // throws 429 if over
    // ... rest of Task 36 pipeline
}
```

If LLM call fails after quota increment, the user already lost 1 from their quota. Acceptable trade-off — alternative (rollback on failure) leaks abuse potential (spam LLM with 0-count cost).

### Step 4: `NlSearchQuotaResetJob`

```java
@Component
public class NlSearchQuotaResetJob {
    private final DSLContext jooq;

    @Scheduled(cron = "0 0 0 1 * ?", zone = "Asia/Seoul")
    @Transactional
    public void resetMonthlyQuotas() {
        int reset = jooq.update(USERS)
            .set(USERS.NL_SEARCH_COUNT_MONTH, 0)
            .set(USERS.NL_SEARCH_COUNT_RESET_AT, DSL.currentOffsetDateTime())
            .where(USERS.NL_SEARCH_COUNT_MONTH.gt(0))
            .execute();
        log.info("NL search quota reset: {} users", reset);
        Sentry.captureMessage("nl_search_monthly_reset", SentryLevel.INFO);
    }
}
```

Enable in `IronSpotApplication`:

```java
@SpringBootApplication
@EnableScheduling
public class IronSpotApplication {}
```

### Step 5: `SecurityConfig` change

```java
http.authorizeHttpRequests(auth -> auth
    .requestMatchers("/api/admin/**").authenticated()  // method-level @PreAuthorize does role
    .requestMatchers("/api/search/natural").authenticated()  // new
    .requestMatchers(HttpMethod.POST, "/api/photos/**").authenticated()
    // ... existing matchers ...
    .anyRequest().authenticated()  // or permitAll on read endpoints, already set
);
```

### Step 6: `app.json` restoration

```diff
   "android": {
     "package": "com.ironspot.app",
     "permissions": [
       "android.permission.ACCESS_COARSE_LOCATION",
       "android.permission.ACCESS_FINE_LOCATION",
-      "android.permission.CAMERA"
+      "android.permission.CAMERA",
+      "android.permission.RECORD_AUDIO"
     ]
   },
```

iOS plist entries — Expo auto-injects from plugin config. For SFSpeechRecognizer we need:

```json
"ios": {
  "bundleIdentifier": "com.ironspot.app",
  "supportsTablet": false,
  "infoPlist": {
    "NSMicrophoneUsageDescription": "자연어 검색에서 음성 입력을 받기 위해 마이크 접근이 필요합니다. 녹음은 저장되지 않습니다.",
    "NSSpeechRecognitionUsageDescription": "말씀하신 검색어를 텍스트로 변환하기 위해 음성 인식이 필요합니다."
  }
}
```

The strings explicitly disclaim recording storage — App Store reviewers look for honest privacy statements.

### Step 7: Integration tests

`NlSearchQuotaServiceIT`: seed user, call 99 times → success, 100th throws TOO_MANY_REQUESTS, manually reset → 1st succeeds again.

`NlSearchQuotaResetJobIT`: insert 5 users with count = 50, invoke job, assert all 5 reset to 0.

### Commit

```
feat(phase-3): 37 — NL Search rate limit + monthly cron + auth gate

- Migration: users.nl_search_count_month + users.nl_search_count_reset_at.
- NlSearchQuotaService: atomic increment-with-limit. 100th call → 429 with
  helpful Korean message. Race-safe.
- NlSearchQuotaResetJob: @Scheduled("0 0 0 1 * ?", Asia/Seoul) resets all users
  to 0, captures Sentry INFO event for ops visibility.
- SecurityConfig: /api/search/natural now authenticated().
- app.json: RECORD_AUDIO restored (intentional reversal of PR #47 — Phase 3 voice
  STT is a new requirement). iOS NSMicrophoneUsageDescription +
  NSSpeechRecognitionUsageDescription added with explicit "녹음 저장 안 함" disclaimer.
- 2 IT files covering happy quota path, 100th-call rejection, and reset job.
```

---

## Task 38: NL Search UI + Voice input + result chip + map mapping (Frontend)

**Goal:** Map screen top bar with text input + 🎙 mic button. STT result fills input box (no auto-search). Submit fires `/api/search/natural`, results update map markers + show interpretation chip. 0-results state shows "조건을 완화하시겠어요?" CTA.

**What must be complete before calling this task done:**

- `TopSearchBar` component on Map tab — text input with placeholder "예: 강남역 1km 안 파나타 머신 3개"
- 🎙 button uses `expo-speech-recognition` — tap to start, auto-stop on 1s silence, fills input
- Recent search history (last 10) stored in MMKV, surfaces on input focus
- Recommended example queries surface on first launch / empty history
- Submit → `useNlSearch(query)` mutation → invalidate map gym markers
- Interpretation chip below search bar shows LLM's parsing
- 0 results → fallback CTA "조건을 완화하시겠어요?" navigates to FilterPanel
- 16+ frontend tests covering: text input, voice toggle, voice permission denied, recent history surface, submit fires mutation, interpretation chip renders, 0-results CTA
- Maestro flow: deep link to map → type query → submit → assert map markers change

**Files to create / change:**

```
src/features/search/                                                  (new feature dir)
src/features/search/routes.ts
src/features/search/query-keys.ts                                     (searchKeys.recent / .results(query))
src/features/search/constants.ts                                      (RECENT_HISTORY_MAX = 10, EXAMPLE_QUERIES, MIC_SILENCE_TIMEOUT_MS)
src/features/search/hooks/useNlSearch.ts                              (TanStack mutation)
src/features/search/hooks/useRecentSearches.ts                        (MMKV-backed)
src/features/search/hooks/useVoiceInput.ts                            (expo-speech-recognition wrapper)
src/features/search/components/TopSearchBar.tsx
src/features/search/components/MicButton.tsx
src/features/search/components/SearchHistoryDropdown.tsx
src/features/search/components/InterpretationChip.tsx
src/features/search/components/RelaxFiltersCTA.tsx
src/features/search/components/__tests__/...                          (16+ tests)
src/features/map/components/MapScreen.tsx                             (modify — embed TopSearchBar, react to NL results)
.maestro/flows/nl-search-flow.yaml                                    (new)
package.json                                                          (modify — add expo-speech-recognition)
```

### Step 1: `useVoiceInput`

Hook wraps `expo-speech-recognition`. Returns `{ isListening, start, stop, transcript, error }`. `start()` requests permission, starts recognizer with `lang: 'ko-KR'`, 1s silence auto-stops. Permission denied → returns helpful error, hook caller shows toast.

### Step 2: `MicButton`

Pressable with 🎙 icon. Tap → calls `useVoiceInput().start()` if not listening, else `.stop()`. While listening, replace icon with reanimated waveform pulse. On `transcript` arrival, parent fills input box.

### Step 3: `TopSearchBar`

```tsx
<View className="px-4 py-2 bg-bg-base">
  <View className="flex-row items-center gap-2 bg-bg-muted rounded-md px-3">
    <MaterialIcons name="search" size={20} color={colors.text.tertiary} />
    <TextInput
      placeholder="예: 강남역 1km 안 파나타 머신 3개"
      value={query}
      onChangeText={setQuery}
      onSubmitEditing={() => onSubmit(query)}
      onFocus={() => setShowDropdown(true)}
      className="flex-1 py-3 text-body"
      returnKeyType="search"
    />
    <MicButton onTranscript={text => setQuery(text)} />
  </View>
  {showDropdown && <SearchHistoryDropdown ... />}
</View>
```

### Step 4: `useNlSearch` mutation

```tsx
export function useNlSearch() {
  const queryClient = useQueryClient();
  const { coords } = useUserLocation();
  return useMutation({
    mutationFn: (query: string) =>
      unwrapOrvalResponse(
        searchApi.usePostSearchNatural({
          query,
          userLat: coords.lat,
          userLng: coords.lng,
        }),
      ),
    onSuccess: (data, query) => {
      queryClient.setQueryData(searchKeys.results(query), data);
      recentSearches.add(query);
    },
    onError: (err) => {
      if (err.response?.status === 429)
        burnt.toast({ title: '이번 달 검색 한도를 모두 사용했어요', preset: 'error' });
      else if (err.response?.status === 400)
        burnt.toast({ title: '검색 조건을 다시 입력해 주세요', preset: 'error' });
      else burnt.toast({ title: '검색에 실패했어요. 잠시 후 다시 시도해주세요', preset: 'error' });
    },
  });
}
```

### Step 5: `MapScreen` integration

Embed `TopSearchBar` at top of Map. When NL search succeeds, replace the FilterPanel-driven gym list with the NL result list, render `InterpretationChip` below the search bar, render `RelaxFiltersCTA` overlay when `totalCount === 0`.

Existing `useMapSearch` / `FilterPanel` flow keeps working — both write to the same `gyms` state via a small reducer (`gymsSource: 'filter' | 'nl'`). Switching between them clears the other's chip.

### Step 6: Recent searches + example seeds

```ts
// constants.ts
export const EXAMPLE_QUERIES = [
  '강남역 1km 안 파나타 머신 3개',
  '내 위치 500m 안 케이블 머신 있는 곳',
  '테크노짐 + 프라임 둘 다 있는 헬스장',
] as const;
export const RECENT_HISTORY_MAX = 10;
export const MIC_SILENCE_TIMEOUT_MS = 1000;
```

`useRecentSearches` reads/writes MMKV key `nl-search-recent`. Drops oldest when over 10.

### Step 7: Maestro flow

```yaml
appId: com.ironspot.app
---
- launchApp
- tapOn:
    id: 'tab-map'
- tapOn:
    id: 'top-search-input'
- inputText: '내 위치 1km 안 케이블 머신'
- pressKey: 'Enter'
- assertVisible:
    id: 'interpretation-chip'
```

Voice flow as a separate file (`nl-search-voice-flow.yaml`) — Maestro can't drive the system microphone, so this flow asserts UI states (mic button toggles, dropdown closes) rather than actual STT.

### Commit

```
feat(phase-3): 38 — NL Search UI + voice + interpretation chip

- TopSearchBar embedded in Map tab: text input + 🎙 mic + recent history dropdown.
- useVoiceInput wraps expo-speech-recognition (ko-KR, 1s silence auto-stop, permission
  fallback toast). MicButton tap-to-toggle + reanimated waveform while listening.
- useNlSearch mutation: ky POST /search/natural, 429/400/5xx → distinct toasts,
  recent history MMKV add on success.
- InterpretationChip below search bar surfaces LLM's parsing — "강남역 1km 안 /
  파나타 하이로우 3개 each + 프라임 3개 each".
- RelaxFiltersCTA overlay when totalCount === 0: tap navigates to FilterPanel with
  the brand/category pre-applied from the parsed DSL.
- MapScreen reducer reconciles gymsSource: 'filter' | 'nl' — switching one mode
  clears the other's chip.
- 16 frontend tests + Maestro nl-search-flow (text path; voice path covers UI states).
- Total tests: 414 → 430.
```

---

## Task 39: Path-filtered eval workflow + Sentry breadcrumb (Observability)

**Goal:** The third layer of the LLM testing defense. GitHub Actions workflow runs the eval suite only on PRs that touch `prompts/`, `LlmClient.java`, `SqlBuilder.java`, `DslValidator.java`, or `SearchDsl.java`. Sentry breadcrumbs/captures structured so production NL Search traffic acts as the rolling eval set.

**What must be complete before calling this task done:**

- `.github/workflows/llm-eval.yml` triggers only on PRs touching the listed paths
- Eval suite has 30+ queries with `expected_dsl_semantic` matchers (not exact JSON equality)
- Semantic matcher implementation: brand case-insensitive, machineName Jaccard >= 0.5, location.radius_km tolerance ±0.2km, scope exact match
- Eval runs against real Groq with `GROQ_API_KEY` GitHub Secret
- Eval failure posts comment on PR with first 3 failing cases (input, expected, actual)
- `NlSearchService` `Sentry.addBreadcrumb` for every call, `Sentry.captureMessage('nl_search_empty_result', ...)` rate-limited to 10/hour to stay within 5000 events/month

**Files to create:**

```
.github/workflows/llm-eval.yml                                          (new)
iron-spot-api/src/test/java/com/ironspot/search/eval/EvalSuiteTest.java (new — gated by EVAL_RUN env)
iron-spot-api/src/test/resources/eval/queries.yaml                      (new — 30+ cases)
iron-spot-api/src/test/java/com/ironspot/search/eval/SemanticMatcher.java (new)
```

### Step 1: GitHub Actions workflow

```yaml
name: llm-eval
on:
  pull_request:
    paths:
      - 'iron-spot-api/src/main/resources/prompts/**'
      - 'iron-spot-api/src/main/java/com/ironspot/search/llm/**'
      - 'iron-spot-api/src/main/java/com/ironspot/search/SqlBuilder.java'
      - 'iron-spot-api/src/main/java/com/ironspot/search/DslValidator.java'
      - 'iron-spot-api/src/main/java/com/ironspot/search/dsl/**'

jobs:
  eval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { java-version: '25', distribution: 'temurin' }
      - run: cd iron-spot-api && ./gradlew test --tests EvalSuiteTest
        env:
          EVAL_RUN: 'true'
          GROQ_API_KEY: ${{ secrets.GROQ_API_KEY }}
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
      - if: failure()
        uses: actions/github-script@v7
        with:
          script: |
            // post first 3 failures from build/reports/eval/failures.json
```

### Step 2: `queries.yaml`

```yaml
cases:
  - input: '강남역 1km 안 파나타 머신 3개'
    expected:
      location: { type: named_place, name: 강남역, radius_km: 1.0 }
      machineFilters:
        - { brand: panatta, minCount: 3, scope: each }

  - input: '내 위치 500m 안 케이블 머신 있는 곳'
    expected:
      location: { type: current, radius_km: 0.5 }
      machineFilters:
        - { category: cable, minCount: 1, scope: each }

  # ... 28+ more covering each enum value, multi-filter, combined scope, error cases
```

### Step 3: `SemanticMatcher`

For each field, tolerance rules:

- `location.radius_km`: ±0.2
- `brand`: case-insensitive equality after slug normalization (`Panatta == panatta`)
- `machineName`: `FuzzyMatchService.jaccard(expected, actual) >= 0.5`
- `category`: exact slug match
- `minCount`: exact
- `scope`: exact

Failures collected with `{input, expected, actual, mismatchField}` and serialized to `build/reports/eval/failures.json`.

### Step 4: Sentry breadcrumb rate-limit

```java
private static final Map<String, Long> recentEmptyResults = new ConcurrentHashMap<>();
private static final long EMPTY_RESULT_RATE_LIMIT_MS = 6 * 60 * 1000; // 6 min between same query

private void reportEmptyResult(String query) {
    long now = System.currentTimeMillis();
    Long last = recentEmptyResults.put(query, now);
    if (last == null || (now - last) > EMPTY_RESULT_RATE_LIMIT_MS) {
        Sentry.captureMessage("nl_search_empty_result", scope -> {
            scope.setExtra("query", query);
        });
    }
}
```

Combined with per-call breadcrumb (always added, no Sentry event), this keeps captureMessage well under 10/hour for distinct queries.

### Commit

```
feat(phase-3): 39 — LLM eval workflow + Sentry breadcrumb

- .github/workflows/llm-eval.yml: path-filtered (only fires on prompt / LlmClient /
  SqlBuilder / DslValidator / dsl/** changes). Runs EvalSuiteTest with real Groq
  via GROQ_API_KEY secret. Posts first 3 failures as PR comment.
- queries.yaml: 30+ NL queries with expected_dsl_semantic.
- SemanticMatcher: per-field tolerance (radius ±0.2km, brand case-insensitive slug,
  machineName Jaccard >= 0.5, scope exact). Failure report serialized to
  build/reports/eval/failures.json.
- NlSearchService Sentry: breadcrumb per call (input, dsl, totalCount, durationMs);
  captureMessage for empty results rate-limited to 1 per 6min per distinct query,
  stays well under 10/hour and under Sentry 5000 events/month free tier.
- Eval workflow estimated cost: ~500 Groq calls/month assuming 10 LLM-touching PRs.
  Groq daily limit 1000, monthly 30000 — eval uses <2%. $0 confirmed.
```

---

## Task 40: Phase 3 Final Verification

**Goal:** Phase 3 lockdown. All Phase 3 flows verified live on Render + EAS preview-simulator. PROGRESS.md marked complete. Pre-Launch Backlog and Phase 4 documents updated with carried-over items.

**What must be complete before calling this task done:**

- Live `/api/admin/reports` returns the seeded pending report under a real admin JWT
- Live `/api/search/natural` returns gyms + interpretation + totalCount under real user JWT (test query against seeded gym data)
- Quota: 100 calls succeed, 101st returns 429. Reset cron not waitable in live — instead trigger via SQL (`UPDATE users SET nl_search_count_month = 0`) and verify recovery
- iOS Simulator preview build (`eas build --profile preview-simulator`) installed; tap mic → speak → text fills → submit → results land on map
- Maestro: nl-search-flow + admin-flow (admin queue + photo detail navigation) green on iOS Simulator
- Sentry dashboard shows NL Search breadcrumb events
- Final `pnpm jest` (430+ tests) and `./gradlew test` (Phase 3 backend ITs) both green
- `docs/plans/phase-3/PROGRESS.md` updated with all 8 Tasks marked complete + commit SHAs
- `docs/plans/phase-4/README.md` created with: scope (carried-over items from Q1), goal, link from PROGRESS.md

**Steps:**

1. Run `pnpm lint && pnpm exec tsc --noEmit && pnpm jest` — assert all green
2. Run `cd iron-spot-api && ./gradlew test` — assert all green
3. Run `pnpm e2e:all` — assert Maestro suite green
4. EAS build + install + manual verification of voice flow
5. Live curl verification of `/api/admin/*` and `/api/search/natural` against Render
6. Update PROGRESS.md
7. Create Phase 4 README
8. Open Phase 3 close PR

### Commit

```
chore(phase-3): 40 — Phase 3 final verification + Phase 4 README

- Live verify: /api/admin/reports (admin JWT), /api/search/natural (user JWT +
  quota smoke + Sentry breadcrumb confirmed).
- iOS Simulator: voice flow tap → speak → submit → markers update.
- Maestro: nl-search-flow + admin-flow green.
- 430 frontend tests + Phase 3 backend ITs green.
- PROGRESS.md: Tasks 33-40 complete with commit SHAs.
- phase-4/README.md: scope (PII detection, gym_machine reporting, reporter
  trust scoring, appeal flow, web admin UI, NL query caching) + transition
  notes from Phase 3 → 4.
```

---

## Pre-Launch Backlog (post-Phase 3, before App Store submission)

Items needed before iOS App Store submission that are not in Phase 3 numbered Tasks:

### Apple Sign In wiring (code already in PR #46)

- Apple Developer Program enrollment ($99/year)
- Apple Service ID + Return URL at developer.apple.com
- Supabase Apple provider config
- `app.json` `ios.usesAppleSignIn: true`
- Maestro flow: iOS Apple button → system sheet → authenticated

### Privacy Policy + Terms of Service

- Write content (Korean, Phase 1+2+3 data flows)
- Host at stable URLs (GitHub Pages or simple static host)
- Link from app footer + App Store Connect

### UptimeRobot keep-warm (optional)

- 5-minute ping on `/actuator/health` to prevent 15-minute Render free-tier sleep
- Already documented in `docs/harness/operations.md`

---

## Out of Phase 3 Scope (Reference)

Tracked in `phase-4/README.md` (created in Task 40):

- Photo PII detection (FACE_DETECTION + mosaic vs reject + backfill)
- Reporter trust scoring + auto-ban
- Appeal flow for false-positive auto-blinds
- `gym_machine` target_type for reports
- Standalone admin web UI (Next.js)
- NL query caching (LLM bypass for repeat queries)
- Multi-select FilterPanel filters (ADR 0020 — also still deferred)
- Push notifications (post-launch: expo-server-sdk-java)
- Dark mode (post-launch)
- Analytics / PostHog (post-launch)

---

## Task Summary

| Task | Description                                 | Track            | Blocks |
| ---- | ------------------------------------------- | ---------------- | ------ |
| 33   | Admin role + 4 admin endpoints              | Backend          | 34     |
| 34   | Admin in-app screens (queue + photo detail) | Frontend         | —      |
| 35   | LlmClient + DSL + prompts + snapshots       | Backend          | 36, 39 |
| 36   | NL Search backend pipeline                  | Backend          | 37, 38 |
| 37   | Rate limit + cron + auth + RECORD_AUDIO     | Backend + config | 38, 40 |
| 38   | NL Search UI + Voice + chip + map           | Frontend         | 40     |
| 39   | Eval workflow + Sentry breadcrumb           | Cross            | 40     |
| 40   | Phase 3 final verification                  | Verification     | —      |

## User Review Checkpoints

| Checkpoint | After Tasks | Reviews                                                 |
| ---------- | ----------- | ------------------------------------------------------- |
| 11         | 33–34       | Admin foundation — role, endpoints, in-app screens      |
| 12         | 35–36       | NL Search backend — LLM abstraction, DSL, SQL builder   |
| 13         | 37–38       | Quota + voice UI integration                            |
| 14         | 39–40       | Eval workflow, Sentry observability, final verification |
