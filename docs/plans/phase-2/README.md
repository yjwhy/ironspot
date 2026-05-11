# Phase 2: Spring Boot + Auth + Upload + OCR

**Status:** Not started. Plan will be written after Phase 1 completion.

## Scope (from architecture doc)

1. Spring Boot 4 + Java 25 API server setup (initial setup in Task 16 was on 3.5.0; pivoted to 4 in Task 31)
2. Docker + docker-compose
3. Supabase Auth integration (Google/Kakao social login)
4. JWT validation with Spring Security
5. Photo upload pipeline (resize → upload → OCR → match → register)
6. Google Vision API integration
7. Upvote/report system with transaction
8. New gym registration via Naver Places API
9. Orval: OpenAPI spec → TypeScript client + TanStack Query hooks
10. Migrate app data source from Supabase direct → Spring Boot API
11. My Page full implementation
12. Account settings (nickname edit, account deletion)

## Deferred from Phase 1

13. **머신 모델 멀티셀렉트 검색** — 특정 기구 여러 개(예: "Panatta High Row + Hammer Strength DY Row")를 모두 보유한 헬스장을 찾는 검색 플로우. Phase 1의 브랜드/카테고리 단일 선택 필터로는 구현 불가. 필요한 작업:
    - `searchGymsInBounds` RPC를 머신 템플릿 ID 배열 + ALL 매칭으로 재작성
    - 기구 위시리스트 선택 UI (별도 검색 플로우)
    - 결정 배경: [ADR 0020](../../adrs/0020-filter-panel-over-scrollbar.md)

## Files to add here

- `implementation.md` — detailed task breakdown (written after Phase 1 completes)
- Any ADRs specific to Phase 2 decisions
