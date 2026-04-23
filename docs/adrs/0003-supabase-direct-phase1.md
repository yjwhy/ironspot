# ADR 0003: Phase 1은 Supabase 직접 연결, Phase 2+ 부터 API 서버 도입

**Status:** Accepted · 2026-04-09

## Context

Phase 전략으로 개발 낭비 없이 백엔드를 점진적으로 확장. MVP를 빠르게 출시하면서도 백엔드 아키텍처 설계 역량을 증명해야 함.

## Decision

**Phase 1:** Expo 앱이 `supabase-js`로 Supabase 직접 호출.
**Phase 2+:** 앱과 Supabase 사이에 Spring Boot API 서버 도입.

## Alternatives

- **첫날부터 Spring Boot** — MVP 2-3주 지연. Phase 1 자체가 출시되지 않을 리스크.
- **Supabase Edge Functions만** — 포트폴리오에서 "함수 몇 개 짠 것"으로 보임. 백엔드 설계 역량이 드러나지 않음.

## Consequences

**긍정적:**

- Phase 1 MVP 2-3주 내 완성 → 어느 시점에서든 포트폴리오 제출 가능
- 서비스 레이어 추상화 덕분에 API 전환 시 앱 코드 거의 변경 없음 (서비스 내부만 `supabase.rpc()` → `ky.get('/api/...')` 교체)
- Phase 2에서 앱 재작성 없이 백엔드 설계 증명 가능
- 비즈니스 로직이 Spring Boot에 집중 → 아키텍처 역량을 한 곳에서 증명

**부정적:**

- Phase 1 보안 수준이 낮음 (RLS만 — 읽기 전용/비로그인이라 허용)
- Phase 간 검증 로직 일부 중복 (Phase 1은 검증이 최소라 수용 가능)
