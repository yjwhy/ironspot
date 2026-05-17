---
Status: Accepted
Date: 2026-05-17
Implements: 0020-filter-panel-over-scrollbar.md (deferred Phase 2/3 wishlist scope)
---

# 0022 — 머신 템플릿 필터 + 브랜드 prefix chip + AND 검색 모드

## Context

ADR 0021 가 슬라이드다운 패널 → BottomSheetModal 구조 업그레이드를 완료했지만, Task 44 머지 직후 사용자 시뮬레이터 테스트에서 두 가지 본질적 문제가 표면화됨:

1. **카테고리 라벨 mislabel**: 시트의 "머신 종류" 섹션이 보여주는 데이터는 실제로는 `categories` 테이블 (Chest / Back / Arms / Legs / Shoulders) = **신체 운동 부위** 정보. 진짜 머신 종류 (Chest Press, Seated Row, MTS Shoulder Press 등) 는 `machine_templates` 테이블에 별도 존재하지만 UI 에 진입점 없음.
2. **Compound brand × machine 쿼리 표현 불가**: 사용자가 "Panatta 의 High Row + Low Row + Hex Squat 와 Hammer 의 Chest Press 를 모두 보유한 헬스장" 같은 정확한 compound 쿼리를 표현하려 하면, 현재 (브랜드 OR + 머신이름 deduplicated OR) 필터 모델에서는 의도와 SQL 의미가 어긋남 (cross-product fan-out 문제). 즉 "어느 브랜드든 High Row + Low Row + Hex Squat + Chest Press 를 보유" 로 해석되어, 정확히 "Panatta 의 머신 + Hammer 의 머신" 구분 안 됨.

두 증상은 ADR 0020 이 Phase 1 에서 명시적으로 deferred 했던 항목:

> 머신 모델 멀티셀렉트 검색은 Phase 1 에 포함하지 않는다. 이유: searchGymsInBounds RPC 가 브랜드/카테고리 단일 값 기반으로 작성돼 있어, 머신 모델 배열을 받아 "모두 보유한 헬스장" 을 찾으려면 RPC 재작성이 필요하다. 특정 머신 복수 지정은 단순 필터가 아니라 "기구 위시리스트" 수준의 별도 검색 플로우에 가깝다.

ADR 0020 은 이를 Phase 2/3 으로 미뤘으나, NL Search (Task 38b) 가 이미 `SearchDsl.machineFilters` + `templateIds` + `scope: EACH | COMBINED` 구조로 구현된 상태라 백엔드는 준비 완료. structured filter UI 만 노출되지 않았을 뿐.

본 ADR 는 Phase 4 Task 45 에서 이 deferred 항목을 정식 closeout 하며, 추가로 라벨 mislabel 도 같이 정정한다.

## Decision

**`machine_templates` 를 표현하는 신규 "머신" 필터 차원을 추가하고, chip 단위는 per-template (브랜드 prefix 포함) 으로 잠근다.**

핵심 결정 7개:

1. **카테고리 라벨 정정**: 기존 "머신 종류" 섹션 라벨 → **"운동 부위"** (실제 데이터와 일치). DB schema 무변경.
2. **신규 머신 차원 추가**: `machine_templates` 행을 chip 으로 표현하는 **"머신"** 섹션 신설. 시트 섹션 순서: 운동 부위 → 브랜드 → 머신.
3. **머신 chip 단위 = per-template (브랜드 prefix 라벨)**: chip 라벨 형식 `"브랜드명 머신명 · 핀/플레이트"` (예: `"Panatta High Row · 핀"`). name-deduplicated 방식 (예: `"High Row"` 하나만 노출) 은 cross-product 의미 모호로 명시적으로 거부.
4. **OR 디폴트 + AND 토글 (2+ 선택 시 조건부 노출)**: 머신 multi-select 의 의미 = 디폴트 OR (브랜드/운동부위와 일관). 2개 이상 선택 시 토글 `"선택한 머신 모두 보유한 헬스장만"` 노출. 백엔드 `scope: EACH | COMBINED` 에 1:1 매핑.
5. **글로벌 LoadingType SegmentedControl 제거**: 머신 chip 이 loading_type 을 자기 라벨에 포함하므로 글로벌 필터 redundant + 의미 모호 ("핀로딩 머신 보유한 헬스장" 은 실효 use case 없음).
6. **브랜드 필터 섹션 유지 (직교)**: 머신 chip 이 브랜드 내포하지만, "이 브랜드의 머신을 (아무거나) 보유한 헬스장" 광역 빠른 필터 use case 유효. 두 차원 SQL 에서 AND 결합.
7. **NL Search 결과 lossless 매핑**: `parsedFilters.templateIds` + `scope === 'combined'` → 머신 chip 활성화 + AND 토글 ON. Task 38b 의 dropped condition 토스트가 머신/scope 항목 제거 (이제 완전 매핑).

추가 UX 결정:

- 머신 섹션 검색 input = 임계치 0 (항상 노출, 200-400 templates 예상)
- 정렬 = 브랜드 1차 + 이름 2차 (`useBrands` locale-aware 정렬 패턴과 일관)
- ActiveFilterStrip 확장: 머신 chip + AND 모드 시 끝에 `"🔗 모두 보유 ×"` chip
- GymBottomSheet 카드에 `"매칭된 머신: A, B 외 +N"` 미리보기 추가 (top 5)

## Alternatives

**A. Name-deduplicated chips ("High Row" 한 chip)**
브랜드 정보 손실. 사용자 의도 "Panatta 의 High Row" vs "Hammer 의 High Row" 표현 불가. 별도 브랜드 필터로 보완하려 해도 cross-product fan-out 발생 (예: 브랜드 [Panatta, Hammer] + 머신 [High Row, Low Row, Hex Squat, Chest Press] + AND = "어느 브랜드든 4종" 으로 풀려서 의도 어긋남). 거부.

**B. Wishlist 별도 플로우** (별도 진입점 + multi-step picker)
새 entry point + state 동기화 + 모드 분리 학습 비용. 사용자가 grill 4라운드에서 단일 머신 섹션 + AND 토글 충분히 직관적임을 확인. 거부.

**C. 글로벌 LoadingType 유지 + chip indicator 병행**
글로벌 필터의 실효 use case 거의 없음 ("핀 머신 보유한 헬스장" 쿼리 발생 빈도 낮음). 머신 chip 의 suffix 가 동일 정보 제공. 시트 섹션 1개 절약 + 의미 단순화 위해 제거.

**D. brand 필터 제거 (머신이 브랜드 내포하므로 redundant)**
"Panatta 헬스장 어디?" 광역 빠른 필터 use case 손실. 사용자가 머신 픽 안 하고 그냥 브랜드만 보고 싶은 경우 다수의 머신 chip 일일이 선택해야 함 (피곤). 직교 유지.

**E. NL Search 의존 (compound 쿼리는 자연어로)**
NL Search 이미 가능하지만 쿼터 100/월 + LLM 지연 + 발견성 낮음. structured filter 가 두 단점 모두 해결. NL 은 자연어 표현 편의로 유지.

## Consequences

### 데이터 모델 (변경 없음)

- `machine_templates` 테이블 기존 그대로 사용 (`brand_id`, `category_id`, `name`, `loading_type`)
- `searchGymsInBounds` RPC (Supabase 직접) 가 아닌 Spring Boot `GymRepository.searchInBounds` (Task 33 마이그레이션 후) 가 검색 경로

### 백엔드

- `GymSearchRequest` DTO 확장: `templateIds: List<String>`, `scope: SearchScope` (= `EACH | COMBINED`). `loadingType` 필드 제거.
- `GymRepository.searchInBounds` jOOQ 쿼리:
  - OR (EACH): `mt.ID.in(templateIds)`
  - AND (COMBINED): `HAVING COUNT(DISTINCT CASE WHEN mt.ID IN (...) THEN mt.ID END) = N` 패턴 (또는 EXISTS 분리). NL Search `SqlBuilder` 의 COMBINED 로직과 의미 동일하지만 별도 jOOQ 구현 유지 (DSL shape 다름).
  - `mt.LOADING_TYPE.eq(...)` 조건 제거.
- `GymWithMachineCountResponse` 확장: `matchedMachineNames: List<String>` (top 5, "브랜드 + 머신명" 형식, ordered).
- jOOQ enum `SearchScope` 신규 (또는 NL Search 의 기존 enum 재사용).
- IT 케이스 추가: OR templates, AND templates, 혼합 brand + templates, 매칭 머신 응답 검증.

### 프론트엔드

- `SearchFilters` 확장: `templateIds: readonly string[]`, `machineFilterMode: 'or' | 'and'`. `loadingType` 제거.
- `useFilters`: `toggleTemplate`, `setMachineFilterMode`, `INITIAL_FILTERS` 갱신. `setLoadingType` 제거.
- `useMachineTemplates` 신규 hook (`useBrands` / `useCategories` 패턴, locale-aware 정렬 = 브랜드 → 이름).
- FilterSheet:
  - 라벨 "머신 종류" → "운동 부위"
  - 새 "머신" 섹션 (FilterSheetSection 재사용, `searchThreshold={0}`)
  - LoadingType SegmentedControl 제거 (LOADING_SEGMENTS 상수 제거)
  - AND 토글 컴포넌트 (Switch, 2+ 선택 시 노출)
- `active-filters.ts` view-model 확장: `ActiveFilterKind = 'brand' | 'category' | 'machineTemplate'` (loadingType 제거), `toActiveFilters` 가 templateIds 매핑 + AND 모드 표현.
- `ActiveFilterStrip`: 머신 chip 추가 + AND 모드 시 끝에 `"🔗 모두 보유 ×"` chip.
- `applyParsedFiltersAndExitNl`: NL 결과의 `templateIds` + `scope` 매핑.
- GymCard (또는 GymBottomSheet 의 card 렌더): 매칭 머신 미리보기 줄.

### Maestro

- `.maestro/flows/filter-sheet-flow.yaml` 갱신: LoadingType segmented control 검증 제거, 머신 차원 검증 추가.

### Phase 4 Task 순서 영향

- Task 45 = 본 ADR 의 작업 (기존 Task 45 "gym_machine report target" → Task 46 강등)
- Task 46-49 = 기존 Task 45-48 각 +1 강등 (의존성: 신 Task 48 admin-flow Maestro 는 신 Task 47 Apple Sign In 의존 유지)

### Cost

- LLM: 0 (no NL calls)
- Vision API: 0
- DB schema migration: 0
