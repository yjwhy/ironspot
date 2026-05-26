# Security Audit — MEDIUM & LOW Backlog (2026-05)

Re-extracted on 2026-05-26 from a fresh `security-reviewer` pass across BE, DB, APP, AI, CI. Original audit catalogued these as bundle entries (#53–62, #79–80) without sub-items; this doc enumerates them so each can be triaged individually.

CRITICAL / HIGH findings (audit items #7–52, #63–78) are tracked in [audit-2026-05.md](audit-2026-05.md) — 65/80 closed.

Severity: 🟡 MEDIUM, 🟢 LOW. Effort: S (≤1h), M (≤½ day), L (≤full day). Closed items carry ✅; PR # is recorded in this doc + commit history.

## Progress (2026-05-26 session)

**42 / 61 shipped.** PRs #236-#256 landed the autonomous quick wins.

| Section       | Total | Closed | Remaining                               |
| ------------- | ----- | ------ | --------------------------------------- |
| §A BE MEDIUM  | 12    | 7      | A2, A3, A4, A5, A12                     |
| §B BE LOW     | 10    | 6      | B1, B4, B6, B7                          |
| §C DB MEDIUM  | 4     | 3      | C4                                      |
| §D DB LOW     | 6     | 2      | D1, D2, D3, D4                          |
| §E APP MEDIUM | 7     | 3      | E1, E2, E3, E4                          |
| §F APP LOW    | 6     | 3      | F1, F2 (no-op), F6                      |
| §G AI MEDIUM  | 6     | 5      | G3                                      |
| §H AI LOW     | 5     | 4      | H1 (already covered by WebClientConfig) |
| §I PI MEDIUM  | 2     | 0      | I1, I2                                  |
| §J PI LOW     | 3     | 1      | J1, J2                                  |
| §K CI MEDIUM  | 7     | 5      | K3, K4                                  |
| §L CI LOW     | 6     | 3      | L1, L2, L4                              |

Remaining by effort: ~5 × S (L1, L2, L4, K4, F2 no-op verify), ~12 × M (design decisions or refactors), 2 × L (A3 Storage TTL, B1 Redis migration).

---

## §A. BE MEDIUM (12)

### ✅ A1. Google Vision API key in URL query string

`iron-spot-api/src/main/java/com/ironspot/photo/OcrService.java:100`. `VISION_URL + "?key=" + apiKey` puts the key in the URL, which lands in `WebClientResponseException` messages, Sentry breadcrumbs, intermediate proxy logs. `AdminBrandTransliterateService` already uses the `x-goog-api-key` header. **Fix:** switch to header. **Effort:** S.

### ✅ A2. X-Forwarded-For trusted unconditionally

`UploadRateGate.resolveIp` (shared by `GlobalRateLimitFilter`, etc.) takes the leftmost X-Forwarded-For without validating that the immediate remote address is Render's proxy. A client setting the header to a rotating value bypasses per-IP RPM caps. **Fix:** trust only when remote addr matches Render's proxy CIDR list, or use Spring's `ForwardedHeaderFilter` with `trustedProxies`. **Effort:** M.

### 🟡 A3 (Phase 1 ✅, Phase 2 pending). Signed Storage URL stored verbatim in DB

`StorageService.upload` returns a 365-day signed URL which is persisted in `machine_photos.photo_url`. A DB leak / backup dump / Sentry capture hands over a year-long bearer credential per photo. **Fix:** store only the bucket-relative path; mint a short-TTL (15-60 min) signed URL at response time. **Effort:** L.

### ✅ A4. No re-auth or grace window on account deletion

`UserService.deleteAccount` runs on a single valid JWT — a stolen token (or borrowed unlocked phone) nukes the account instantly. PIPA "right to erasure" expects intent confirmation. **Fix:** require ≤5min re-auth challenge, log to `moderation_audit_log`. **Effort:** M.

### ✅ A5. Unsalted SHA-256 of 사업자번호

`BusinessRegistrationVerifier.java:151-160`. 10-digit business number has ~33 bits of entropy — a precomputed rainbow table of all 10^10 SHA-256 values fits in ~640 GB and reverses every hash in milliseconds. **Fix:** HMAC-SHA256 with a server-side pepper, or Argon2id with per-row salt. **Effort:** M.

### ✅ A6. Owner-claim OCR bypasses Vision quota

`OwnerController.claim` → `OcrService.analyzeImage` directly, skipping `PhotoService.enforceVisionQuota`. A user can drain Vision free tier through this endpoint; only the global per-IP RPM gates it. **Fix:** add per-user daily claim cap (e.g. 5/day) similar to `NaverSearchQuotaService`. **Effort:** S.

### ✅ A7. AdminBrandTransliterateRequest not `@Valid`-annotated

`AdminBrandTransliterateController.java:41`. The controller doesn't validate the DTO, only the service does (via `sanitiseInputString`). A 10 MB payload passes the rate cap and reaches Gemini before the size check. **Fix:** add `@Valid` + `@Size(max=80)` + `@Pattern` on the DTO. **Effort:** S.

### ✅ A8. Unbounded `int limit` on admin list endpoints

`AdminController` and three other admin controllers accept `@RequestParam(defaultValue="50") int limit` with no `@Max` cap. A compromised admin or a misclicked deep link can request `Integer.MAX_VALUE` rows, exhausting Hikari. **Fix:** `@Min(1) @Max(200)` + `@Validated`. **Effort:** S.

### ✅ A9. Smoke endpoints lack `@PreAuthorize("hasRole('ADMIN')")`

`SlackSmokeController.java:36`, `SentrySmokeController.java:27` are gated by JWT + `enabled=true` flag only. During a smoke window any authenticated user can fire Slack alerts impersonating moderation events. **Fix:** add `@PreAuthorize("hasRole('ADMIN')")`. **Effort:** S.

### ✅ A10. Sentry has no `beforeSend` PII scrubbing (BE)

`SentryConfig.java:35-47` doesn't strip Authorization headers, `?key=` query params, `email` claims, or stack traces with embedded image bytes. The FE side has #37 but the BE Sentry is unscrubbed. **Fix:** add `setBeforeSend((event, hint) -> ...)` mirroring the FE scrubber. **Effort:** M.

### ✅ A11. Naver synthetic place ID collision risk

`NaverSearchService.java:188-196`. Two genuinely different gyms with identical road address + name (chain branches with no road suffix) collide on `synthetic_<sha16>`. Silent merge symptom. **Fix:** include lat/lng in digest input, or reject results without real Naver id. **Effort:** S.

### 🟡 A12. Co-owner claim race (no FOR UPDATE)

`OwnerService.java:78-90`. `existingBusinessHashForGym` (SELECT) and `insertActive` (INSERT) are in the same `@Transactional` but the SELECT is not `FOR UPDATE`. Two parallel claims with different business hashes both pass, both insert. **Fix:** `FOR UPDATE` or partial UNIQUE INDEX with dispute-on-violation. **Effort:** M.

---

## §B. BE LOW (10)

### 🟢 B1. In-memory rate-limit counters reset on deploy

Caffeine in-process means Render redeploy / cold restart wipes all windows. **Fix:** persist to Postgres `rate_limit_buckets` table or Redis. **Effort:** L.

### ✅ B2. BindException leaks DTO field names

`GlobalExceptionHandler.java:36-41` returns `field + ": " + defaultMessage` exposing internal field names to API probers. **Fix:** generic message client-side, detailed log server-side. **Effort:** S.

### ✅ B3. User UUID logged in plaintext (quota / abuse alerts)

`PhotoService:340,349,358`, `NaverSearchQuotaService:74`, `UploadRateGate:76`, `GlobalRateLimitFilter:97`. PIPA conservatively treats account identifiers as personal data. **Fix:** truncate to first 8 chars or HMAC with daily-rotating pepper. **Effort:** S.

### 🟢 B4. `matchesGymName` substring too permissive

`BusinessRegistrationVerifier.java:126-132`. `a.contains(b) || b.contains(a)` lets a 사업자 with short 상호 `"강남"` claim ownership of any gym containing `"강남"`. **Fix:** token-set Jaccard ≥ 0.7 after normalisation, or fall to Disputed. **Effort:** M.

### ✅ B5. No nickname uniqueness / impersonation guard

`UserRepository.updateNickname:119-126`. Two users can share `"운영자"` or `"admin"`. **Fix:** reserved-list check or partial UNIQUE INDEX on `lower(nickname)`. **Effort:** S.

### 🟢 B6. NTS API key in URL query string

`BusinessRegistryClient.java:93-94`. Same risk class as A1. **Fix:** move to header or request body. **Effort:** S.

### 🟢 B7. BusinessException messages leak business state

E.g. "이 매장은 이미 다른 사업자가 소유 인증을 마쳤어요" confirms ownership state to a probe. **Fix:** map sensitive-state messages to generic "권한이 없습니다", log precise reason server-side. **Effort:** M.

### ✅ B8. nl_search_log.raw_query not redacted on user delete

`UserService.deleteAccount` only nulls `user_id`; raw_query body lives for 30 more days carrying deleted user's PII. **Fix:** during the cascade, also set `raw_query='[redacted]'` immediately. **Effort:** S.

### ✅ B9. Slack webhook URL has no startup validation

`AdminNotificationService.java:21`. Env-var poisoning sends moderation alerts (photo IDs, user IDs, ban events) to attacker-controlled host. **Fix:** `@PostConstruct` validates HTTPS + host equals `hooks.slack.com`. **Effort:** S.

### ✅ B10. No decoded-pixel-count guard before Vision call

`OcrService.java:181-197`. 2 MB PNG that decodes to 100,000 × 100,000 pixels OOMs JVM heap before Vision is called. **Fix:** reject when `width * height > 25_000_000` (25 MP) at the dimensions probe. **Effort:** S.

---

## §C. DB MEDIUM (4)

### ✅ C1. `reports.detail` unbounded TEXT

`V1__baseline.sql:130`. No length cap. **Fix:** `CHECK (char_length(detail) <= 500)` + apply Slack-style strip when reading. **Effort:** S.

### ✅ C2. `moderation_audit_log.metadata` JSONB unbounded

`V2__task47_gym_owner.sql:53-61`. Multi-MB rows possible if a future caller passes OCR text. **Fix:** `CHECK (octet_length(metadata::text) <= 4096)` + retention job. **Effort:** S.

### ✅ C3. `gym_owners.business_number_hash` no format CHECK

Column accepts any string. A buggy refactor could persist the raw 사업자번호. **Fix:** `CHECK (business_number_hash ~ '^[0-9a-f]{64}$')`. **Effort:** S.

### 🟡 C4. `gyms.naver_place_id` UNIQUE mixes real + synthetic

Real Naver IDs and `synthetic_<...>` IDs share the same uniqueness namespace. Collision merges separate gyms. **Fix:** separate column or explicit CHECK distinguishing the two. **Effort:** S.

---

## §D. DB LOW (6)

### 🟢 D1. `reports.target_id` has no FK

Polymorphic via `target_type` but no referential integrity. **Fix:** trigger-enforced check or partial CHECK pinning target_types. **Effort:** M.

### 🟢 D2. `users.email` has no UNIQUE constraint

Supabase Auth enforces in `auth.users`, but the public mirror can drift. **Fix:** `CREATE UNIQUE INDEX users_email_active_uniq ON users(lower(email)) WHERE deleted_at IS NULL`. **Effort:** S.

### 🟢 D3. `vision_cache` has no DB-side expiry CHECK

Retention is purely Java-side; if the job fails silently rows live forever. **Fix:** `pg_cron` extension or trigger as a backstop. **Effort:** M.

### 🟢 D4. `users.role` could use ENUM instead of TEXT-with-CHECK

Hard typing vs. soft typing. **Fix:** `CREATE TYPE user_role AS ENUM (...)` + `ALTER COLUMN`. **Effort:** M.

### ✅ D5. `nl_search_log.outcome` is free-text

`V3__nl_search_log.sql:31`. No length cap; analytics `GROUP BY outcome` would explode on multi-MB values. **Fix:** `CHECK (char_length(outcome) <= 64)`. **Effort:** S.

### ✅ D6. `gym_owners.business_number_hash` not indexed

Future "find all gyms by business" query does a full scan. **Fix:** `CREATE INDEX idx_gym_owners_business_hash ON gym_owners(business_number_hash) WHERE revoked_at IS NULL`. **Effort:** S.

---

## §E. APP MEDIUM (7)

### 🟡 E1. Recent-searches MMKV stores raw queries in plaintext

`src/features/search/lib/recent-storage.ts:9-39`. Same plaintext-on-disk concern as #14. **Fix:** move to expo-secure-store, or normalise + truncate before persisting + add TTL. **Effort:** S.

### 🟡 E2. `useKeepBackendWarm` bypasses api-client

`src/shared/hooks/useKeepBackendWarm.ts:30-33`. Raw fetch against `${API_URL}/actuator/health` skips auth-injection, scrubber, and retry policy. **Fix:** route through helper, gate on `useNetworkStatus`, add jittered backoff. **Effort:** S.

### ✅ E3. OAuth callback parser doesn't verify origin

`parseAuthCallback.ts:23-44` extracts `code` from any URL without verifying scheme/host match. PKCE keeps this safe today, but the parser is the only validation point. **Fix:** reject when `protocol + host` differs from `AUTH_REDIRECT_URL`. **Effort:** S.

### 🟡 E4. apiClient swallows refresh failure into a 401

`src/shared/lib/api-client.ts:56-78`. Callers can't distinguish "no session" vs "expired during use" — can't deterministically clear stale tokens. **Fix:** throw `SessionExpiredError` subclass on refresh-then-retry failure, top-level handler calls `signOut()`. **Effort:** S.

### ✅ E5. NL search 400 body rendered verbatim

`useNlSearch.ts:115-118` shows whatever BE wrote in `ErrorResponse.error`. **Fix:** cap to ~120 chars + NFC + `\p{C}` strip on FE before render. **Effort:** S.

### ✅ E6. Sentry env DSN bypasses Zod schema

`src/shared/lib/sentry.ts:15-16` reads `process.env` directly. Malformed DSN crashes `Sentry.init` at runtime instead of failing fast at module load. **Fix:** add `EXPO_PUBLIC_SENTRY_DSN: z.string().url().optional()` to `env.ts`. **Effort:** S.

### ✅ E7. `parseSelection` doesn't validate templateId UUID

`UploadMachinePhotoScreen.tsx:61-75`. 5MB `text` or non-UUID `templateId` passes through to BE. **Fix:** Zod schema mirroring `uuidSchema` + 100-char text cap. **Effort:** S.

---

## §F. APP LOW (6)

### 🟢 F1. Owner cover blob fetch loses MIME on iOS

`OwnerCoverPhotoScreen.tsx:34-35`. `fetch().blob()` drops WebP MIME on iOS. **Fix:** build blob with explicit `type: 'image/webp'` or use FormData. **Effort:** S.

### ✅ F2. `console.warn` in production upload path

`UploadPhotoScreen.tsx:67`. Banned by CLAUDE.md. **Fix:** guard with `__DEV__`. **Effort:** S.

### ✅ F3. ErrorBoundary logs raw error to console

`ErrorBoundary.tsx:50`. Component stacks can include user-supplied props. **Fix:** restrict to `__DEV__`. **Effort:** S.

### ✅ F4. Deep-link `shortLabelSchema` allows combining marks

`deeplink-params.ts:38-41`. `\p{M}` not excluded — minor UX-spoofing surface. **Fix:** exclude `\p{M}` or apply NFC + strip. **Effort:** S.

### ✅ F5. `directions.openDirections` doesn't bound gym.name length

`shared/lib/directions.ts:99-102`. 200-char name builds 1KB+ URL; nmap rejects. **Fix:** truncate to 60 chars. **Effort:** S.

### ✅ F6. Auth refresh has no retry budget

`api-client.ts:68-75`. Single attempt, no backoff. Flaky networks → hard logout. **Fix:** single retry with 1s backoff on transport-level failures. **Effort:** S.

---

## §G. AI MEDIUM (6)

### ✅ G1. `MachineFilter` fields have no length cap

`search/dsl/MachineFilter.java:3-21`. `brand`, `machineName`, `category` unconstrained. **Fix:** 80-char caps in compact constructor. **Effort:** S.

### ✅ G2. LLM `userQuery` size not capped at the client boundary

`GroqLlamaClient.java:71`, `GeminiFlashClient.java:74`. `NlSearchRequest.query` capped at 200 but the LLM clients re-accept any String. **Fix:** add guard at top of each `parse(String)`. **Effort:** S.

### 🟡 G3. `OcrService.readImagePixelCount` exposes ImageIO

`OcrService.java:181-197`. JDK ImageIO is a known image-bomb vector. **Fix:** wrap with hard time budget + reject declared dimensions > ~100 MP before allocation. **Effort:** M.

### ✅ G4. `NlSearchEmptyResultReporter` keys ConcurrentHashMap by raw query

`NlSearchEmptyResultReporter.java:35,55`. Adversary mints thousands of distinct empty queries — unbounded heap. **Fix:** key on `Normaliser.normalise(query)` truncated to 50 chars + max 1000 entries. **Effort:** S.

### ✅ G5. Raw query interpolated into `log.warn` on Naver merge failure

`NlSearchService.java:130-132`. Operator log stream carries PII. **Fix:** `SafeEcho.truncate(Normaliser.normalise(query), 50)`. **Effort:** S.

### ✅ G6. `stripCodeFence` duplicated in two LLM clients

`GroqLlamaClient.java:149-162`, `GeminiFlashClient.java:188-199`. Drift risk on future safety fixes. **Fix:** extract to shared `LlmResponseSanitiser`. **Effort:** S.

---

## §H. AI LOW (5)

### 🟢 H1. LLM clients' WebClient `maxInMemorySize` not pinned

Cap is sent upstream but ObjectMapper accepts any response body. Default `maxInMemorySize` is 256 KiB. **Fix:** pin `ExchangeStrategies.builder().codecs(...)` explicitly. **Effort:** S.

### ✅ H2. `FallbackLlmClient` swallows INVALID_RESPONSE without breadcrumb

`FallbackLlmClient.java:56-59`. INVALID_RESPONSE is the signature of a successful prompt injection — ops loses the signal. **Fix:** emit Sentry breadcrumb `category=llm.invalid_response` before re-throwing. **Effort:** S.

### ✅ H3. `FuzzyMatchService.tokenize` ignores Korean punctuation

Splits on `\s+` only. `"Panatta·하이로우"` stays as one token. **Fix:** split on `[\s\p{Punct}]+` (excluding hyphen). **Effort:** S.

### ✅ H4. `VisionCacheRepository.sha256` doesn't bound input

`VisionCacheRepository.java:52-60`. Future caller skipping the controller cap pays unbounded CPU. **Fix:** assert `imageBytes.length <= 2 MB` at top. **Effort:** S.

### ✅ H5. `FuzzyMatchService.bestMonolingualScore` NPE on null `nameEn`

`FuzzyMatchService.java:191`. Korean-only templates crash the matcher. **Fix:** null guard mirroring `nameKo` line. **Effort:** S.

---

## §I. PI MEDIUM (residual, 2)

### 🟡 I1. `nl_search_log` writes raw queries without per-row encryption

Backup snapshot during the 30-day window persists every user's raw search text in plaintext. **Fix:** shorten retention to 7d, drop raw entirely, or encrypt at rest with pgcrypto. **Effort:** M.

### 🟡 I2. PIPA consent recorded AFTER session exchange

`LoginScreen.tsx:82-86`. Consent write runs after `exchangeCodeForSession` — PIPA Article 22 expects it before processing. **Fix:** record consent before code exchange, or retry consent write before granting `onAuthenticated`. **Effort:** M.

---

## §J. PI LOW (3)

### 🟢 J1. Sentry email mask keeps 2 chars of local part

`sentry-scrub.ts:76-83`. `yj***` uniquely identifies a tester pool member. **Fix:** mask to 1 char or HMAC the entire email. **Effort:** S.

### 🟢 J2. Empty-result reporter retains raw query in heap 6min

`NlSearchEmptyResultReporter.java:55`. Heap dumps capture queries. **Fix:** key on SHA-256 of normalised query. **Effort:** S.

### ✅ J3. Vision API key in URL query string

Duplicates A1 (same finding from PI lens — query string credentials leak via proxy logs). **Fix:** `x-goog-api-key` header. **Effort:** S.

---

## §K. CI MEDIUM (7)

### ✅ K1. `pull_request_target` in dependabot-auto-merge

`.github/workflows/dependabot-auto-merge.yml:8`. Runs in base-repo context with write tokens — pwn-request pattern if a future maintainer adds `actions/checkout` here without pinning to base ref. **Fix:** comment forbidding checkout, or split trigger. **Effort:** S.

### ✅ K2. `dependency-review` fail-on-severity is high

`security-scans.yml:76`. Moderate-severity CVEs merge silently. **Fix:** `fail-on-severity: moderate` + `comment-summary-in-pr: on-failure`. **Effort:** S.

### 🟡 K3. Slack webhook URL has no rotation policy

`deploy-notify.yml:25,49,160`. Bearer-equivalent secret with no documented rotation cadence. **Fix:** switch to Slack GitHub App (`slackapi/slack-github-action` with bot token) or document rotation. **Effort:** M.

### ✅ K4. Naver Maps client_id committed to app.json

`app.json:42`. Hardcoded in source — no per-env rotation. **Fix:** `app.config.ts` reading `EXPO_PUBLIC_NAVER_MAPS_CLIENT_ID` via EAS secrets. **Effort:** S.

### ✅ K5. Docker base images use floating Alpine tags

`Dockerfile:8,12,47`. Mutable tags defeat the SHA-pinning posture established for GHA. **Fix:** pin to digests + Dependabot docker ecosystem. **Effort:** S.

### ✅ K6. Dependabot has no Docker ecosystem

`.github/dependabot.yml`. Base images never auto-bumped → CVE-laden layers sit unpatched. **Fix:** add `package-ecosystem: docker` block. **Effort:** S.

### ✅ K7. No npm audit / SCA on JS pipeline

`ci.yml:20-54`. Lint+typecheck+test only. CVEs published against installed transitives don't surface. **Fix:** add weekly `pnpm audit --audit-level=high --prod` or `osv-scanner`. **Effort:** S.

---

## §L. CI LOW (6)

### 🟢 L1. EvalSuiteTest exposes GROQ + GEMINI keys to whole job

`llm-eval.yml:58-62`. Step-level env shared with later `upload-artifact` step. **Fix:** split into 2 jobs (eval with secrets, upload without). **Effort:** S.

### 🟢 L2. Shell interpolation risk in deploy-notify jq calls

`deploy-notify.yml:28,40-45`. Today safe via `--arg`, but a future refactor that drops it becomes a shell-injection sink. **Fix:** add comment marking inputs untrusted + wrap with `toJSON(...)`. **Effort:** S.

### ✅ L3. Gradle wrapper not validated in CI

`api-ci.yml:32`, `llm-eval.yml:52`. Poisoned `gradle-wrapper.jar` runs with full build privileges. **Fix:** pass `validate-wrappers: true` to `gradle/actions/setup-gradle`. **Effort:** S.

### 🟢 L4. keep-warm cron pings prod with token-bearing runner

`keep-warm.yml:22-30`. Unused but issued `GITHUB_TOKEN`; curl with no `--max-redirs`. **Fix:** `permissions: {}` + curl hardening, or remove workflow (UptimeRobot covers). **Effort:** S.

### ✅ L5. EAS lacks production / submit profile

`eas.json:6-18`. Only `preview-simulator` exists; a hasty `eas build --profile production` falls through to CLI defaults. **Fix:** pre-declare empty production + submit profiles with node + image pins. **Effort:** S.

### ✅ L6. No comment asserting `--frozen-lockfile` invariant

`api-ci.yml:58`. orval regen depends on it; a future refactor removing the flag would silently diverge. **Fix:** comment block above install step. **Effort:** S.

---

## Triage summary

**61 findings total** (39 MEDIUM + 22 LOW), grouped by autonomy + impact:

- **Quick wins (S effort, autonomous, ~30 items):** A1, A6, A7, A8, A9, A11, B2, B3, B5, B6, B8, B9, B10, C1, C2, C3, C4, D2, D5, D6, E2, E3, E4, E5, E6, E7, F2, F3, F4, F5, F6, G1, G2, G4, G5, G6, H1, H2, H3, H4, H5, J1, J2, J3, K1, K2, K4, K5, K6, K7, L1, L2, L3, L4, L5, L6
- **Medium effort (M, autonomous):** A2, A4, A5, A10, A12, B4, B7, D1, D3, D4, G3, I1, I2, K3
- **Large (L, requires schema migration / cross-cutting refactor):** A3, B1

**Next session work:** start with the quick-win batch (~30 items), ship as 4-5 PRs grouped by area. Then tackle MEDIUMs sequentially.

---

_Re-extracted 2026-05-26 via `security-reviewer` agents. Companion to [audit-2026-05.md](audit-2026-05.md) (CRITICAL + HIGH retrospective)._
