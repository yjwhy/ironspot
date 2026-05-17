---
Status: Superseded by 0021
Date: 2026-05-05
Superseded-by: 0021-filter-sheet-supersedes-panel.md
Superseded-date: 2026-05-17
---

# 0020 — 필터 UI: 가로 스크롤 바 → 필터 버튼 + 슬라이드다운 패널

> **Superseded by ADR 0021** (2026-05-17). brand/category multi-select 는 Task 38b 에서 이미 완료되었고, 본 ADR 의 슬라이드다운 패널은 brand/category 수가 늘어남에 따른 세로 무한 증식 + 탐색 도구 부재 + `loadingType` 미노출 한계가 드러나 `BottomSheetModal` 로 교체되었다. 본 ADR 의 Phase 1 rationale (특히 bottom sheet 중첩 제스처 충돌 회피 결정) 은 보존 가치가 있어 본문을 유지한다.
>
> **Implemented by ADR 0022** (2026-05-17, Phase 4 Task 45). 본 ADR 의 Phase 2/3 deferred 항목 ("머신 모델 멀티셀렉트 검색" + "기구 위시리스트 별도 검색 플로우") 은 ADR 0022 에서 per-template chip + AND 토글 형태로 closeout 됨. 별도 플로우 없이 단일 필터 시트 안에 통합.

## Context

Task 13에서 구현된 `FilterBar`는 지도 위에 브랜드·카테고리 칩을 가로 스크롤로 나열한다. 브랜드 수가 늘어날수록 스크롤해야 선택지를 확인할 수 있어 UX가 나빠진다. 또한 브랜드와 카테고리가 한 줄에 섞여 있어 두 차원의 필터가 시각적으로 구분되지 않는다.

필터 개선 방향을 논의하는 중, 유저가 "Panatta High Row **와** Hammer Strength DY Row를 **둘 다** 보유한 헬스장을 찾고 싶다"는 요구를 제기했다. 이는 현재 브랜드/카테고리 레벨 필터로는 불가능한 머신 모델 레벨 멀티셀렉트 검색이다.

## Decision

**Phase 1 (이번 변경):** 필터 버튼 + 슬라이드다운 패널 UI로 교체한다.

- 지도 우상단 필터 버튼 하나. 활성 필터가 있으면 뱃지 표시.
- 버튼 탭 시 지도 상단에서 패널이 슬라이드다운. 브랜드 / 머신 종류 두 섹션으로 명확히 분리.
- 브랜드 단일 선택 + 카테고리 단일 선택 유지 (`SearchFilters` 스키마 변경 없음).
- 지도 터치 시 패널 닫힘.

하단에 이미 `GymBottomSheet`가 존재하므로 bottom sheet 중첩 제스처 충돌을 피하기 위해 bottom sheet 대신 상단 슬라이드다운 패널을 선택했다.

**머신 모델 멀티셀렉트 검색은 Phase 1에 포함하지 않는다.** 이유:

1. `searchGymsInBounds` RPC가 브랜드/카테고리 단일 값 기반으로 작성돼 있어, 머신 모델 배열을 받아 "모두 보유한 헬스장"을 찾으려면 RPC 재작성이 필요하다.
2. 특정 머신을 복수로 지정해 검색하는 행위는 단순 필터가 아니라 "기구 위시리스트" 수준의 별도 검색 플로우에 가깝다.
3. Phase 1 목표는 지도 기반 탐색 완성이며, 검색 정확도 개선은 Phase 2/3 범위다.

## Alternatives

**A. 가로 스크롤 유지, 브랜드 멀티셀렉트만 추가**
브랜드 여러 개 + 카테고리 하나가 AND로 결합되면 "Hammer OR Panatta AND Chest Press" 같은 모호한 쿼리가 생긴다. 유저 입장에서 AND/OR 의미가 불명확하므로 제외.

**B. 머신 모델 멀티셀렉트 즉시 구현**
RPC 재작성 + 별도 검색 UI까지 포함하면 Phase 1 범위를 크게 초과한다. Phase 2/3로 분리해 독립 Feature로 설계하는 것이 낫다.

## Consequences

- 필터 버튼/패널 컴포넌트 신규 작성 (`FilterButton`, `FilterPanel`).
- `FilterBar` 컴포넌트 및 관련 테스트 삭제.
- `MapScreen`에서 FilterBar → FilterButton 교체 (레이아웃 단순화).
- `SearchFilters` 타입·`useFilters` 훅·`searchGymsInBounds` RPC 변경 없음.
- 머신 모델 멀티셀렉트 검색은 Phase 2/3 `docs/plans/phase-2/README.md`에 범위 항목으로 등록.
