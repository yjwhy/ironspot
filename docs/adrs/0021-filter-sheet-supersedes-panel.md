---
Status: Accepted
Date: 2026-05-17
Supersedes: 0020-filter-panel-over-scrollbar.md
---

# 0021 — 필터 UI: 슬라이드다운 패널 → BottomSheetModal

## Context

ADR 0020 은 Phase 1 시점에 `FilterBar` (가로 스크롤 칩) 를 슬라이드다운 `FilterPanel` 로 교체했다. 당시 결정의 두 축은 (a) bottom sheet 중첩 제스처 충돌 회피 (`GymBottomSheet` 와 동시 표시 우려) 와 (b) Phase 1 구현 비용 최소화 였다.

Task 38b (PR #79) 가 `SearchFilters` 를 multi-select 로 확장했고 (`brandIds: string[]`, `categoryIds: string[]`), 백엔드 `GymSearchRequest` 도 배열 + `loadingType` 까지 완전히 plumbed 된 상태다. 다만 `FilterPanel` UI 는 다음 한계를 가지고 있다:

1. **세로 무한 증식** — `flex-wrap` 으로 chip 펼침. brand 50개면 12+ 행 × ~40px ≈ 480px → 지도 절반을 가린다. 슬라이드다운의 본래 장점(맥락 유지)이 무너지는 임계점이 작은 데이터 규모에서 도래한다.
2. **시각 가중치 불균형** — `loadingType` 같은 2지선다 enum 과 brand (50+) 가 같은 chip wrap 으로 표현될 자리가 없다. 정보 위계 표현 수단이 부족하다.
3. **탐색 도구 부재** — 50+ brand 중 특정 브랜드를 찾으려면 시각 스캔에 의존한다. 검색창을 둘 세로 공간이 슬라이드다운에는 없다.
4. **활성 필터 가시성 부족** — `FilterButton` 의 단일 카운트 뱃지로는 "무엇이 켜져있는지" 알 수 없다. 패널을 다시 열어 chip 선택 상태를 재스캔해야 한다.
5. **Reset 부재** — `useFilters.setAll(INITIAL_FILTERS)` 는 존재하지만 UI 진입점 없음. 과도 좁히기로 0건 상태에서 복구가 어렵다.
6. **`loadingType` 미노출** — `SearchFilters.loadingType` 슬롯은 idle. 슬라이드다운 패널 내부에 segmented control 을 둘 자리도 없다.

ADR 0020 의 "bottom sheet 중첩 제스처 충돌" 우려는 Task 38b 이후 `useBottomSheetMode` 훅 (`src/features/map/hooks/useBottomSheetMode.ts`) 도입으로 해결 수단이 생겼다. FilterSheet 가 modal hierarchy 상위에 위치하고, 열릴 때 `GymBottomSheet` 를 collapsed 모드로 강등하면 제스처 충돌은 발생하지 않는다.

## Decision

**`FilterPanel` 컴포넌트를 삭제하고 `FilterSheet` (`@gorhom/bottom-sheet` `BottomSheetModal`) 로 교체한다.**

구성:

- `BottomSheetModal`, snap points `['65%', '90%']`, `enablePanDownToClose=true`. 65% 에서는 지도 일부 + 시트 동시 표시 가능, 90% 에서는 긴 brand 리스트 스캔 편리.
- 시트 내부 구성 (위에서 아래로):
  1. **드래그 핸들** + 제목 "필터" + 닫기 X 버튼.
  2. **로딩 방식** — `SegmentedControl` (전체 / 핀로딩 / 플레이트). 작은 enum 은 segmented control 자리.
  3. **활성 필터 strip** — 활성 brand/category/loadingType 을 가로 스크롤 가능한 칩으로 표시, 각 칩 우측 × 으로 제거. 활성 0 일 때 null.
  4. **브랜드 섹션** — `FilterSheetSection` (헤더 + 선택/전체 카운트 뱃지 + threshold ≥ 8 일 때 검색 input + chip wrap).
  5. **머신 종류 섹션** — 같은 컴포넌트 재사용.
  6. **sticky footer** — 좌측 "전체 해제" (활성 > 0 일 때만), 우측 "확인" (시트 닫기).
- **Live preview 유지** — 칩 토글 시 즉시 지도 마커 갱신. footer 의 "확인" 은 commit 이 아닌 단순 close. 정당화: 지도 검색에서 live-preview 가 진짜 UX 가치 (필터 변경 → 즉시 결과 변화). draft/applied 분리를 의도적으로 도입하지 않음. "전체 해제" 가 over-filter 의 escape hatch.
- **데이터 계층 정렬** — `useBrands` / `useCategories` 의 `select` 옵션에서 `localeCompare('ko')` 로 정렬. 정렬 책임을 데이터 진입 단에 둠 → 모든 consumer 가 동일 순서 (FF predictability).
- **View-model 분리** — `toActiveFilters(filters, brands, categories): ActiveFilter[]` 순수 함수로 활성 필터 칩 구성. `ActiveFilterStrip` 은 view-model 만 받음 (FF coupling 감소).
- **접근성** — SegmentedControl `accessibilityRole="tablist"`, 활성 칩 × 에 구체 `accessibilityLabel`, 검색 input `returnKeyType="search"`, footer 가 safe-area-inset 존중.
- **Reduced motion** — `AccessibilityInfo.isReduceMotionEnabled()` 로 SegmentedControl 슬라이딩 하이라이트 즉시 점프 처리.

## Alternatives

**A. 슬라이드다운 패널 유지 + 내부 재구성 (max-h + ScrollView + 검색)**
ADR 0020 결정을 보존할 수 있고 변경 범위가 작다. 그러나 슬라이드다운은 가로폭이 좁아 검색 input + chip wrap 동시 표시 시 답답하고, 작은 화면 (iPhone SE 등) 에서 `max-h-70vh` 내부 스크롤은 useful 가시 영역이 좁다. brand 100개 시점에 결국 sheet 로 가게 될 것이라 옵션 A 는 부채를 늦출 뿐 갚지 않는다.

**B. Draft/Applied 상태 분리** (시트 안에서만 편집, "적용" 버튼으로 commit)
일반적으로 더 솔리드한 상태 관리 패턴이지만, 지도 필터에서는 live-preview 의 즉각 피드백이 더 큰 UX 가치다. 사용자가 필터 토글마다 결과 변화를 즉시 확인하는 것이 도움이 된다. 대신 "전체 해제" 로 escape hatch 제공.

**C. Floating SegmentedControl** (FilterButton 옆에 항상 노출, 한 탭 절약)
한 번의 탭을 절약하지만 필터 UI 의 single-source-of-truth 가 깨진다 (일부는 시트, 일부는 floating). 사용자는 "어디서 무엇을 바꿨는지" mental model 을 두 곳에 유지해야 한다.

## Consequences

- `src/features/map/components/FilterPanel.tsx` + `__tests__/FilterPanel.test.tsx` 삭제.
- `src/features/map/components/FilterSheet.tsx` 신규.
- `src/features/map/components/FilterSheetSection.tsx` 신규 (검색 가능한 섹션).
- `src/features/map/components/ActiveFilterStrip.tsx` 신규.
- `src/features/map/lib/active-filters.ts` 신규 (view-model 순수 함수).
- `src/shared/components/SegmentedControl.tsx` 신규 (재사용 가능 primitive).
- `src/features/map/hooks/useFilters.ts` 에 `setLoadingType` setter 추가.
- `src/features/map/hooks/useBrands.ts` / `useCategories.ts` `select` 옵션에 locale-aware 정렬 추가.
- `src/features/map/components/MapScreen.tsx` 통합 변경 (`FilterPanel` 사용처 → `FilterSheet` ref-based 호출, `GymBottomSheet` 좌표화).
- `.maestro/flows/filter-sheet-flow.yaml` 신규 (필터 시트 E2E 커버리지).
- ADR 0020 은 Status=Superseded by 0021 로 마킹. 본문은 보존 (Phase 1 결정의 rationale 가치).
- `searchGymsInBounds` RPC 변경 없음 (이미 array + loadingType 수용).
- `SearchFilters` 타입 변경 없음.
