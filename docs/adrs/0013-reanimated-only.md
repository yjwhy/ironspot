# ADR 0013: 애니메이션은 react-native-reanimated만 사용

**Status:** Accepted · 2026-04-10

## Context

앱에 많은 애니메이션 필요: 마커 stagger 등장, Bottom Sheet 스와이프, 필터 칩 전환, OCR 스캔 라인, 사진 hero 전환, 추천 하트 바운스. 라이브러리 선택.

## Decision

**react-native-reanimated 단일 라이브러리.** Lottie, Moti 등 다른 애니메이션 라이브러리 사용 안 함.

## Alternatives

- **+ Lottie** — 디자이너가 만든 일러스트 애니메이션에 적합. 하지만 우리는 디자이너가 만든 JSON 파일 없음. 코드 기반 애니메이션이 엔지니어링 역량 증명에 더 유리.
- **+ Moti** — 선언적 API 좋지만 reanimated 위의 래퍼. 새 기능 추가 없이 의존성만 증가.
- **Animated API (내장)** — JS 스레드에서 동작. 복잡한 애니메이션 (spring + gesture + stagger)에서 프레임 드랍.

## Consequences

**긍정적:**

- 단일 라이브러리로 100% 애니메이션 요구 충족
- UI 스레드에서 실행 → 부하 상황에서도 60fps 보장
- Expo에 기본 포함 (추가 세팅 없음)
- 포트폴리오 가치: "외부 에셋 없이 모든 애니메이션을 코드로 구현"
- 번들 사이즈 절약

**부정적:**

- 일부 복잡한 효과는 Lottie 대비 코드가 많음
- Shared element 전환은 reanimated에서 실험적 — 폴백 플랜 필요
- **2026-05-02 업데이트:** reanimated v4.1.7이 `SharedTransition` API를 완전히 제거. Phase 1은 모달 slide-up으로 fallback. 자세한 내용은 [ADR 0019](./0019-sharedtransition-deferred.md) 참조.

## 구현 규칙

- `transform`과 `opacity`만 애니메이션 (GPU 가속)
- 계산된 애니메이션에 `useDerivedValue` 사용
- iOS/Android의 `prefers-reduced-motion` 존중
- 언마운트 시 애니메이션 취소 (메모리 누수 방지)
