# ADR 0028: 서버 상태 관리는 TanStack Query

**Status:** Accepted · 2026-04-09 (Phase 1 데이터 레이어 확정, 문서는 2026-09-11 소급 작성)

## Context

앱의 대부분 데이터는 서버(Phase 1 Supabase, Phase 2+ Spring Boot API)에서 오는 원격 상태다. 로딩/에러/캐시/재검증/무효화를 화면마다 수동 관리하면 중복과 버그가 늘어난다. 서버 상태와 클라이언트 상태를 분리해 다룰 방법이 필요.

## Decision

**TanStack Query (react-query)** 를 서버 상태 계층으로 사용. 쿼리 키 기반 캐싱/무효화, 자동 재검증, 로딩·에러 상태 표준화. 원격 호출은 서비스 레이어(ky, Phase 2+에서 Orval 생성 클라이언트)로 감싸고 그 위에 TanStack Query 훅을 얹음.

## Alternatives

- **직접 fetch + useState/useEffect** — 의존성 없음. 그러나 캐시/중복 요청 제거/재검증을 전부 수동 구현해야 하고, 화면마다 로딩·에러 처리가 중복됨.
- **Redux Toolkit Query** — 기능은 유사하나 Redux 스토어 도입이 전제. 이 앱은 전역 클라이언트 상태가 적어 Redux 자체가 과함.
- **SWR** — 경량 대안이지만 mutation/무효화/devtools 등 생태계 성숙도에서 TanStack Query가 우위.

## Consequences

**긍정적:**

- 로딩·에러·캐시·재검증이 훅 레벨에서 표준화 → 화면 코드 단순화
- 쿼리 키 기반 무효화로 데이터 정합성 관리가 명시적
- Phase 1 → Phase 2 백엔드 전환 시 서비스 레이어 내부만 교체(`supabase.rpc()` → API 호출)하면 되고 훅 계층은 유지 (ADR 0003과 정합)
- Orval(0012)이 TanStack Query 훅을 생성하므로 Phase 2+에서 생성 클라이언트와 자연스럽게 결합

**부정적:**

- 서버 상태와 클라이언트 상태의 경계를 팀이 명확히 지켜야 함 (남용 시 전역 상태처럼 오용)
- 쿼리 키 설계 규칙이 없으면 무효화가 꼬일 수 있음

## 참고사항

클라이언트 전역 상태(소수)는 별도 경량 수단으로 다루고, 원격 상태는 TanStack Query로 일원화한다. 이 경계 구분이 이 결정의 핵심이다.
