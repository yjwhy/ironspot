# ADR 0007: 컴포넌트 라이브러리 대신 커스텀 컴포넌트 직접 구현

**Status:** Accepted · 2026-04-09

## Context

UI 컴포넌트 접근 방식 결정. 선택지: 풀 라이브러리 (React Native Paper, gluestack-ui) vs NativeWind로 직접 구현.

## Decision

**NativeWind로 전체 컴포넌트 직접 구현.** 컴포넌트 라이브러리 사용 안 함.

## Alternatives

- **React Native Paper** — Material Design. NativeWind와 스타일 충돌. 범용적인 외관.
- **gluestack-ui** — NativeWind 호환이지만 추상 레이어 추가로 범용적 느낌 남음.
- **Tamagui** — 퍼포먼스 좋지만 자체 스타일링 시스템이 NativeWind와 경쟁.

## Consequences

**긍정적:**

- 모든 컴포넌트가 우리 디자인 토큰과 정확히 일치
- 컴포넌트 설계 역량 증명 (포트폴리오 가치)
- 라이브러리 lock-in 또는 브레이킹 체인지 없음
- 작은 번들 (필요한 것만 포함)
- IronSpot UI 대부분이 앱 특화 (헬스장 카드, 마커, 필터 칩, 업로드 플로우) — 라이브러리가 해결해주는 게 없음

**부정적:**

- 기본 컴포넌트 (Button, Chip, Card, Skeleton, EmptyState) 초기 구축 시간
- 접근성 수동 설계 (터치 타겟, 포커스 상태)
- 키보드, safe area 등 컴포넌트별 처리 필요

## 참고사항

컴포넌트를 최소화 (5개 기본 + 기능별 복합체) 하여 상쇄.
