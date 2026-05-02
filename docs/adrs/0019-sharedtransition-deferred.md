# ADR 0019: Phase 1 SharedTransition 보류 (reanimated v4 API 제거)

**Status:** Accepted · 2026-05-02

## Context

`docs/plans/ui-design.md` (line 543) 는 사진 그리드 → 사진 디테일 전환을 **Hero / shared element**로 명시: 사용자가 그리드 셀을 탭하면 그 썸네일이 부드럽게 자라나 전체화면 사진으로 변하는 모션. ADR 0013은 reanimated v3의 `SharedTransition` API + `sharedTransitionTag`로 구현을 가정하고 있었다.

Task 11.4 구현 중 발견:

- 설치된 `react-native-reanimated@4.1.7` 은 **`SharedTransition` API를 완전히 제거**했다 (v4 deprecated → no longer ships types or runtime).
- `Animated.View`의 `sharedTransitionTag` prop은 컴파일 시점에 거부됨 (`Property 'sharedTransitionTag' does not exist on type ...`).
- `node_modules/react-native-reanimated/lib/typescript/` 에 `sharedTransition` / `SharedTransition` 식별자 없음.

## Decision

**Phase 1에서 SharedTransition 구현 보류.** 모달 slide-up (already configured in `app/_layout.tsx` via `presentation: 'modal'`)으로 fallback. UX는 디자인 명세보다 한 단계 평범하지만 즉시 동작하고 추후 업그레이드 경로가 명확함.

## Alternatives

- **react-native-shared-element** — 별도 라이브러리. Expo Router 통합 검증 필요, 설치 + 네이티브 모듈 추가. Phase 1 범위에 비해 통합 비용 큼.
- **react-native-screens v4 native shared elements** — `react-native-screens` v4+ 가 native stack 기반 shared element를 실험적으로 제공. expo-router가 해당 API를 노출해야 함. Phase 2 polish 시점에 재평가.
- **reanimated v3로 다운그레이드** — Expo SDK 54 + RN 0.81 호환 매트릭스가 reanimated 4를 강제. 다운그레이드 시 다른 패키지가 깨질 위험. 거부.

## Consequences

**긍정적:**

- 빌드 즉시 통과, 추가 의존성 없음
- 모달 slide-up 자체가 iOS/Android 모두 자연스러운 전환
- Phase 1 출시 일정 영향 없음

**부정적:**

- 디자인 명세 대비 시각적 임팩트 손실 (사진이 "자라나는" 느낌 부재)
- ADR 0013의 "포트폴리오 가치: 모든 애니메이션을 코드로 구현" 주장이 한 항목 약화

## 후속 작업

- Phase 2 polish 단계에서 `react-native-screens` v4+ native shared element + expo-router 통합 재시도
- `src/features/photo/components/PhotoGrid.tsx` BestCutCard 위 코드 코멘트로 breadcrumb 남김
- `docs/harness/lessons.md` 에 v4 API 제거 사실을 기록하여 다음 세션이 같은 시도를 반복하지 않도록 함

## 영향 범위

- `src/features/photo/components/PhotoGrid.tsx` — BestCutCard에 `sharedTransitionTag` 미적용
- `src/features/photo/components/ZoomableImage.tsx` — `sharedTransitionTag` prop 미노출
- `src/features/photo/components/PhotoPager.tsx` — `initialPhotoId` prop 미사용
- `app/_layout.tsx` — `presentation: 'modal'` 그대로 유지 (변경 없음)
