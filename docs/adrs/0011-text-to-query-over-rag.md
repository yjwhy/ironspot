# ADR 0011: 자연어 검색은 RAG 대신 text-to-query 방식

**Status:** Accepted · 2026-04-13

## Context

Phase 3에서 자연어 검색 구현: "현재 위치에서 1km 내 파나타 5개 이상". text-to-query (LLM → 구조화 필터 → SQL)와 RAG (데이터 임베딩 + 검색) 중 선택.

## Decision

**text-to-query 파이프라인.** LLM이 의도를 구조화된 JSON으로 파싱 → PostGIS SQL 동적 생성 → 실행.

## Alternatives

- **RAG (Retrieval Augmented Generation)** — 비정형 데이터 (리뷰, 문서)에 적합. 우리 데이터는 고도로 구조화 (브랜드, 카테고리, 위치, 수량). SQL로 정확한 답이 나오는 질문에 RAG는 퍼지 매칭 결과를 반환.
- **키워드 검색** — "1km 내 ... 5개 이상" 같은 복합 조건 처리 불가.

## Consequences

**긍정적:**

- 정확하고 결정적인 결과 (SQL은 매칭되거나 안 되거나)
- RAG 대비 빠름 (단일 DB 쿼리 vs 벡터 조회 + LLM 생성)
- 저렴 (벡터 DB 없음, 임베딩 파이프라인 없음)
- LLM 호출 최소화 — 파싱만, 답변 생성 안 함
- 면접에서 답변 가능: "구조화된 데이터엔 벡터 검색 불필요, RAG는 오버엔지니어링"

**부정적:**

- 주관적 쿼리 ("초보자한테 좋은 헬스장") 처리 불가 — 하지만 향후 범위
- LLM 파싱 실패 시 명확한 에러 복구 필요

## 향후 참고

주관적 쿼리 (리뷰, 추천) 기능 추가 시 pgvector (Supabase 내장) + RAG 조합이 적합해짐. 그 시점에 새 ADR 작성.
