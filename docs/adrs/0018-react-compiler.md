# ADR 0018: React Compiler 채택

**Status:** Accepted · 2026-04-28

## Context

React 19.1 + Expo SDK 54 환경에서 메모이제이션 전략 결정. Phase 1은 아직 코드베이스가 작지만 (훅 9개 + 공용 컴포넌트 6개), Task 9~14에서 라우터·바텀시트·갤러리·맵이 추가되며 컴포넌트가 빠르게 늘어난다. 매 컴포넌트에 `useCallback` / `useMemo` / `React.memo`를 손으로 박는 것은 (a) 누락 시 성능 회귀 (b) 박기는 했지만 deps 배열이 잘못된 경우 (c) 코드 가독성 저하의 세 가지 비용을 모두 발생시킨다.

React Compiler (RC) 1.0이 Expo SDK 54에 정식 통합 (`babel-preset-expo`가 `babel-plugin-react-compiler` 자동 주입). `app.json`의 `experiments.reactCompiler: true` 한 줄로 활성화 가능. RC는 컴포넌트와 훅의 의존성을 정적으로 분석해 런타임 메모이제이션 코드를 자동 생성한다.

## Decision

**Phase 1 도중 (Task 8 완료 시점)에 React Compiler 활성화.** 새로 작성하는 코드는 수동 `useCallback` / `useMemo`를 사용하지 않는다. 기존 수동 메모이제이션은 점진적으로 제거 (큰 리팩터를 강제하지 않음).

ESLint는 `eslint-plugin-react-compiler@19.1.0-rc.2`의 `react-compiler/react-compiler` 룰을 `error`로 등록. RC가 메모이제이션을 포기해야 하는 패턴 (불순 함수, 미사용 디렉티브 등)을 린트 단계에서 차단한다.

## Alternatives

- **Phase 1 끝 (Task 15)에서 활성화** — Task 9~14 동안 수동 메모이제이션을 작성하게 되므로, RC 도입 시 그 코드가 모두 사장. 도입 시점이 늦어질수록 정리 비용 증가.
- **Phase 2까지 미룸** — RC가 RC 단계 (Release Candidate)라 안정성 우려는 있으나, Expo SDK 54가 정식 지원하고 `babel-plugin-react-compiler`가 1.0.0이라 미루는 명확한 이유가 약함.
- **수동 메모이제이션 유지** — 일관성은 있지만 누락·실수 비용이 누적. 코드 리뷰에서 매번 `useCallback` 누락을 지적해야 함.
- **RC + `'use memo'` 디렉티브 명시 모드** — 점진적 도입에 유용하지만 SDK 54 통합은 디렉티브 없이 전 파일을 컴파일하는 모드가 기본값. 일관성을 위해 전체 적용으로 시작.

## Consequences

**긍정적:**

- 새 컴포넌트/훅 작성 시 인지 부담 감소 — 의존성 배열·`useCallback` 박스를 의식하지 않아도 메모이제이션 자동.
- 의존성 배열 누락으로 인한 stale closure 버그 카테고리 자체가 사라짐 (RC가 의존성을 정적으로 추론).
- 인라인 객체/배열 prop이 더 이상 자식 재렌더의 원인이 아니게 됨 — 가독성 좋은 JSX 패턴을 자유롭게 사용.
- 린트 룰이 RC bail-out을 시각화 → 성능 회귀가 코드 리뷰가 아닌 컴파일 타임에 잡힘.

**부정적:**

- Reanimated worklets, Bottom Sheet의 `useAnimatedStyle` 등 RC와 충돌할 수 있는 핫패스는 케이스별 검증 필요. 충돌 시 `'use no memo'` 디렉티브로 격리.
- 디버깅 시 컴파일된 메모 캐시 코드를 읽어야 할 수 있음 (RC DevTools 확장으로 완화).
- RC 1.0이 RC 단계 — 마이너 버전 업그레이드 시 회귀 가능성. CI에 번들 빌드 검증 (`expo export`)을 추가해 회귀를 조기에 잡을 것.
- 기존 수동 `useCallback` / `useMemo` / `React.memo` 코드가 한동안 공존 → 코드베이스 일관성 일시적 저하. 새 코드부터 RC만 사용하고 기존은 점진 제거.

## 활성화 방법 (검증 완료)

1. `app.json` → `experiments.reactCompiler: true`
2. `pnpm add -D eslint-plugin-react-compiler`
3. `eslint.config.js`에 `react-compiler` 플러그인 + `react-compiler/react-compiler: 'error'` 룰 등록
4. `babel-plugin-react-compiler`는 Expo SDK 54의 transitive dep으로 이미 설치돼 있음 — 별도 추가 불필요
5. `pnpm exec expo export --platform ios`로 Metro 번들 검증 — 로그에 `React Compiler enabled` 확인

## 참고

- React Compiler 공식 문서: https://react.dev/learn/react-compiler
- Expo SDK 54 통합: `babel-preset-expo` v54.0.10에서 `caller.supportsReactCompiler` 자동 처리
- 린트 플러그인은 향후 `eslint-plugin-react-hooks` v6+에 통합 예정 — 시점에 맞춰 마이그레이션
