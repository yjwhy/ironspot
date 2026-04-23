# ADR 0016: 네비게이션은 React Navigation 대신 Expo Router

**Status:** Accepted · 2026-04-18

## Context

Expo 앱의 네비게이션 라이브러리 선택. 2개 후보: React Navigation (전통적, 코드 기반) vs Expo Router (신규, 파일 기반).

## Decision

**Expo Router** 사용.

## Alternatives

- **React Navigation** — 수년간 업계 표준. 더 많은 튜토리얼. 하지만 딥링킹 수동 설정 필요, 타입 안전성도 수동.
- **Expo Router** — Next.js 스타일 파일 기반 라우팅. 딥링킹 자동. typedRoutes 실험 기능으로 타입 안전.

## Consequences

**긍정적:**

- 실서비스 출시를 계획 중이라 딥링킹이 중요 (공유 URL 지원)
- 타입 안전한 라우팅 (typedRoutes 활성화 시)
- Next.js 스타일 → 웹 개발자에게 친숙
- Expo 팀이 직접 관리 → 미래 지향적

**부정적:**

- React Navigation보다 신생 → 일부 엣지 케이스 해결 중
- 파일 기반 라우팅 규칙 학습 필요 (`(tabs)`, `[id]` 등)
- 한국 앱 중 Expo Router 채택 사례가 React Navigation 대비 적음

## 참고

내부적으로 React Navigation을 사용하므로, 문제 발생 시 React Navigation API로도 접근 가능.
