# ADR 0006: 폴더 구조는 Feature 기반으로 구성

**Status:** Accepted · 2026-04-09

## Context

Feature 기반 구조 (`src/features/map/`)와 레이어 기반 구조 (`src/components/`, `src/hooks/` 최상위) 중 선택.

## Decision

**Feature 기반 구조**를 프론트엔드 (Expo)와 백엔드 (Spring Boot) 양쪽에 적용.

```
src/features/{map,gym,photo,auth,search}/{components,hooks,services}
com.ironspot.{map,gym,photo,auth,search}/{Controller,Service,Repository}
```

## Alternatives

- **레이어 기반** (`components/`, `hooks/`, `services/`를 최상위) — 소규모 프로젝트엔 단순. 규모가 커지면 `components/` 안에 50+ 파일 쌓이면서 폴더가 의미를 전달하지 못함.
- **Hexagonal / Clean Architecture** — 이 프로젝트 규모에 오버엔지니어링. 가치 대비 보일러플레이트 과도.

## Consequences

**긍정적:**

- 관련 코드 한 폴더에 모임. 사진 작업? `features/photo/`만 열면 전부 있음
- Phase 경계가 폴더 경계와 일치 (Phase 2에서 `auth/`, `photo/` 추가)
- 프론트와 백엔드가 같은 구조 → 아키텍처 일관성
- 선형 확장 — 새 기능은 새 폴더, 기존 폴더는 안 커짐

**부정적:**

- 공용 컴포넌트는 `shared/` 폴더에 명시적으로 분리 필요
- "god" feature 폴더 만들지 않도록 규율 필요
