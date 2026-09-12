# ADR 0026: 데이터 접근은 JPA/Hibernate 대신 jOOQ

**Status:** Accepted · 2026-04-17 (Phase 2 백엔드 스택 확정과 함께 결정, 문서는 2026-07-27 소급 작성)

## Context

Phase 2 Spring Boot API 서버의 데이터 접근 계층 선정. 한국 백엔드 시장의 사실상 표준은 JPA/Hibernate라, 취업 관점만 보면 JPA가 자연스러운 선택이었음 (ADR 0004의 논리와 동일선상).

그러나 이 앱의 핵심 쿼리 두 종류가 JPA와 잘 맞지 않음:

- **공간 쿼리 (PostGIS)** — 지도 화면 범위 검색에 `ST_MakeEnvelope` / `ST_Within`, 좌표 추출에 `ST_X` / `ST_Y`를 사용 (ADR 0002가 "PostGIS가 핵심 기능"이라 명시).
- **자연어 → SQL 검색** — ADR 0011(text-to-query)에 따라 LLM이 구조화된 DSL을 내면 그것을 SQL로 컴파일. 켜졌다 꺼졌다 하는 optional 필터(지도 범위, 머신 템플릿 멀티셀렉트, AND 토글)를 런타임에 합성해야 하고, 결과 집계에 `array_agg(DISTINCT ...)`와 `COUNT(DISTINCT CASE WHEN ...)` HAVING이 필요.

실제 코드 분포상 저장소 16개 중 14개는 평범한 CRUD라 어느 도구로도 무방하고, 위 부담은 사실상 `GymRepository`의 지도/검색 쿼리 하나에 집중됨.

## Decision

**jOOQ** (코드 생성 기반 type-safe SQL 빌더)를 데이터 접근 계층으로 사용. DB 스키마에서 jOOQ 클래스를 codegen하여 테이블/컬럼을 컴파일 타임에 검증. PostGIS 함수 등 표준 DSL로 표현 불가능한 조각은 `DSL.field(...)` / `DSL.condition(...)`로 raw SQL을 타입 경계 안에서 삽입.

## Alternatives

- **JPA / Hibernate** — 한국 시장 표준. 쉬운 CRUD 14개는 오히려 더 간결했을 것. 그러나 지도/검색 쿼리의 PostGIS 함수는 native query 문자열 또는 Hibernate Spatial(추가 의존성, 함수 커버리지 부분적 — `ST_MakeEnvelope`는 커스텀 등록이나 native로 귀결)이 필요하고, `array_agg`는 JPQL에 없어 native 또는 `function()` 우회가 불가피. 결국 **가장 복잡하고 잘 깨지는 쿼리를 타입 없는 native 문자열로** 쓰게 됨.
- **JPA + native query 한두 개** — 어려운 쿼리만 native로 처리하고 나머지는 JPA. 충분히 타당한 절충안이었음. 다만 "쉬운 건 JPQL, 어려운 건 native 문자열" 두 모델을 병행 유지해야 함.
- **MyBatis** — SQL을 XML/애노테이션으로 외부화. 타입 안전성이 약하고, 동적 쿼리 조립이 `<if>` 태그 기반이라 자바 코드보다 표현력이 떨어짐.
- **Spring Data JDBC** — 경량이지만 복잡한 조인/집계/동적 쿼리 지원이 약해 이 검색 쿼리에는 부적합.

## Consequences

**긍정적:**

- 쉬운 CRUD와 까다로운 지도/검색 쿼리를 **하나의 type-safe 모델**로 일관되게 작성 (두 모델 병행 불필요)
- PostGIS raw 조각을 쓰더라도 `DSL.condition(...)` 파라미터 바인딩으로 SQL 인젝션 방지 — 특히 LLM 출력을 SQL로 변환하는 경로에서 문자열 연결보다 안전
- codegen된 테이블/컬럼 상수로 스키마 변경 시 컴파일 에러로 조기 검출 (Orval 0012 / zod와 같은 end-to-end 타입 안전성 테마와 일관)
- 동적 optional 필터 합성(`DSL.noCondition()`)이 자바 제어 흐름으로 자연스럽게 표현됨

**부정적:**

- 한국 시장 표준(JPA)과 다른 선택이라 팀 온보딩/채용 관점에서 러닝커브 (단, 이 프로젝트는 1인 개발이라 영향 제한적)
- 진짜 jOOQ가 필요한 쿼리는 1~2개뿐 — 대부분의 저장소에서는 jOOQ의 강점이 드러나지 않아, "JPA + native 한 개"였어도 충분했다는 반론이 성립
- 스키마 변경 시 codegen 재실행 필요 (빌드 파이프라인에 testcontainers 기반 codegen 단계 추가)
- ORM의 영속성 컨텍스트/더티 체킹/지연 로딩 등 편의 기능은 포기 (이 앱은 명령형 쿼리 중심이라 손실 크지 않음)

## 참고사항

이 결정은 "JPA로는 불가능해서"가 아니라 "이 앱의 요구(PostGIS + NL→SQL 동적 쿼리)에 jOOQ가 더 잘 맞아서"에 가깝다. 취업 시장 최적화(JPA)와 상충하는 선택이므로, 면접 맥락에서는 "시장 표준은 JPA임을 알지만, 이 앱의 공간·동적 쿼리 특성상 type-safe SQL 빌더가 적합하다고 판단했다"는 트레이드오프 서사로 설명 가능.
