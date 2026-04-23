# ADR 0012: API 클라이언트 자동 생성에 Orval 사용

**Status:** Accepted · 2026-04-13

## Context

Phase 2에서 Spring Boot API 도입. 프론트엔드 (TypeScript)가 API 엔드포인트 호출 필요. 선택지: 타입과 fetch 호출 수동 작성 vs OpenAPI 스펙에서 자동 생성.

## Decision

**Orval**로 Spring Boot의 OpenAPI 스펙 (SpringDoc)에서 TypeScript 클라이언트 + TanStack Query 훅 자동 생성.

## Alternatives

- **수동 작성 API 클라이언트** — 엔드포인트 적을 땐 빠르지만 타입 드리프트 누적. API 변경 시 프론트가 따라가지 않으면 조용한 버그.
- **openapi-typescript-codegen** — 타입은 생성하지만 TanStack Query 훅 지원 없음.
- **tRPC** — Node 백엔드 필요. Spring Boot에 적용 불가.

## Consequences

**긍정적:**

- 백엔드 → 프론트엔드 타입 안전성이 구조적으로 강제됨 (타입 드리프트 불가능)
- TanStack Query 훅 자동 생성 (보일러플레이트 없음)
- 한 명령어 (`pnpm orval`)로 API 변경 시 전체 클라이언트 업데이트
- 면접 어필 포인트: "프론트-백엔드 간 contract 자동화"

**부정적:**

- OpenAPI 스펙 정확도 유지 필요 (SpringDoc가 자동 처리)
- 생성 코드 gitignore 또는 신중한 트래킹 필요
- 워크플로우에 빌드 단계 추가

## 워크플로우

```
1. Spring Boot 엔드포인트 수정 → OpenAPI 스펙 자동 갱신
2. 프론트엔드에서 `pnpm orval` 실행
3. TypeScript + TanStack Query 훅 재생성
4. 컴파일 에러로 프론트 코드가 자동 적응 (타입 안전)
```
