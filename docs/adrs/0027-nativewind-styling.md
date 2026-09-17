# ADR 0027: 스타일링은 NativeWind (Tailwind for RN)

**Status:** Accepted · 2026-04-09 (Phase 1 스타일링 방식 확정, 문서는 2026-09-10 소급 작성)

## Context

React Native 앱 전반의 스타일링 방식 선정. 커스텀 컴포넌트를 직접 구현하는 방침(ADR 0007)이라, 스타일 코드가 앱 전반에 광범위하게 퍼짐. 일관된 디자인 토큰(간격, 색상, 타이포)을 반복 정의 없이 재사용할 방법이 필요.

## Decision

**NativeWind** (Tailwind CSS 문법을 React Native에 적용) 사용. `className` 유틸리티 기반으로 스타일 작성, 디자인 토큰은 `tailwind.config.js`에 집중.

## Alternatives

- **StyleSheet.create (RN 기본)** — 추가 의존성 없음. 그러나 컴포넌트마다 스타일 객체 보일러플레이트가 쌓이고, 디자인 토큰 공유가 수동. 앱 규모가 커질수록 반복 증가.
- **styled-components / emotion** — CSS-in-JS. 런타임 오버헤드가 있고, RN에서 테마 전파 비용이 큼.
- **Tamagui / gluestack 등 UI 프레임워크** — 스타일과 컴포넌트가 묶여 있어 커스텀 컴포넌트 방침(ADR 0007)과 충돌.

## Consequences

**긍정적:**

- 디자인 토큰을 `tailwind.config.js` 한 곳에서 관리 → 간격/색상 일관성 확보 (Amber 강조색 0009 등)
- 유틸리티 클래스로 스타일 코드량 감소, 컴포넌트 가독성 향상
- 웹 Tailwind와 동일한 멘탈 모델 → 컨텍스트 스위칭 비용 감소
- 커스텀 컴포넌트(0007) 위에 스타일만 얹는 구조라 방침과 정합

**부정적:**

- 빌드 파이프라인에 NativeWind/Tailwind 변환 단계 추가 (Metro/Babel 설정 의존)
- 동적 스타일(런타임 계산 값)은 여전히 인라인 style로 처리해야 함
- Tailwind 클래스 문자열이 길어지면 오히려 가독성이 떨어질 수 있음

## 참고사항

이 결정은 커스텀 컴포넌트 방침(ADR 0007)과 짝을 이룬다. UI 프레임워크를 배제하는 대신, 스타일 레이어만 NativeWind로 표준화하여 일관성과 생산성을 확보한다.
