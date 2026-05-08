# Phase 2 — Spring Boot 3 + Java 25 (LTS)

Conventions for the Phase 2 backend service. Loaded only when working under `docs/plans/phase-2/` or the eventual `api/` directory.

## Architecture

- **Layered**: Controller / Service / Repository
- **Package by feature**: `com.ironspot.{auth, gym, machine, photo, search}`
- **Spring Security filter chain**: validate Supabase JWT (Spring Boot does not own user identity)
- **Jakarta Validation** (`@Valid`) for DTO validation
- **SpringDoc OpenAPI** for API documentation
- **`application.yml`** for configuration (not `.properties`)

## API client generation (frontend ↔ backend)

- **Orval**: OpenAPI spec → TypeScript client + TanStack Query hooks
- **Never hand-write API calls** — always regenerate from spec when the spec changes

## Code Review

After writing or modifying any Spring Boot code (`iron-spot-api/**/*.java`, `build.gradle.kts`, `application*.yml`), dispatch `superpowers:code-reviewer` before committing. This applies per-subtask (same as the frontend `code-reviewer` step in the Execution Workflow). Frontend FF review (`/ff-review:review`) does **not** cover Spring Boot — use `superpowers:code-reviewer` instead.

## Testing

- **JUnit 5 + Mockito + MockMvc**
- **Integration tests against a real Postgres** via Testcontainers — never mock the DB. Mocked DB tests have masked broken migrations in past audits.

## Boundaries

- All authentication delegates to Supabase JWT — Spring Boot validates, not issues
- Storage: Supabase Storage (binary), Postgres (metadata)
- No direct DB access from the mobile app for write paths in Phase 2 — all writes go through Spring Boot
