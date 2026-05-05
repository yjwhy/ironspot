# Filter Panel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 지도 위 가로 스크롤 FilterBar를 제거하고, 필터 버튼 + 슬라이드다운 패널(브랜드/카테고리 두 섹션)로 교체한다.

**Architecture:** `FilterBar` 컴포넌트를 삭제하고 `FilterButton`(아이콘 버튼 + 활성 뱃지) + `FilterPanel`(Reanimated 슬라이드다운, 브랜드·카테고리 Chip 섹션)을 신규 작성한다. `MapScreen`에서 패널 열림/닫힘 상태를 `useState`로 관리하고, 지도 터치 시 패널를 닫는다. `useFilters` 훅과 `SearchFilters` 타입은 변경하지 않는다.

**Tech Stack:** React Native, NativeWind v4, Reanimated v4, existing `Chip` + `AppText` components, `MaterialIcons`, `ANIMATION` tokens.

**Branch:** `feat/filter-panel` (based on `task/13-map-screen`)

---

## Task 1: FilterButton 컴포넌트 (TDD)

**Files:**

- Create: `src/features/map/components/FilterButton.tsx`
- Create: `src/features/map/components/__tests__/FilterButton.test.tsx`

### Step 1: 실패하는 테스트 작성

```tsx
// src/features/map/components/__tests__/FilterButton.test.tsx
import { fireEvent, render } from '@testing-library/react-native';
import { FilterButton } from '../FilterButton';

describe('FilterButton', () => {
  it('renders filter icon button', () => {
    const { getByRole } = render(<FilterButton activeCount={0} onPress={() => undefined} />);
    expect(getByRole('button', { name: '필터' })).toBeTruthy();
  });

  it('does not show badge when activeCount is 0', () => {
    const { queryByTestId } = render(<FilterButton activeCount={0} onPress={() => undefined} />);
    expect(queryByTestId('filter-badge')).toBeNull();
  });

  it('shows badge with count when activeCount > 0', () => {
    const { getByTestId, getByText } = render(
      <FilterButton activeCount={2} onPress={() => undefined} />,
    );
    expect(getByTestId('filter-badge')).toBeTruthy();
    expect(getByText('2')).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByRole } = render(<FilterButton activeCount={0} onPress={onPress} />);
    fireEvent.press(getByRole('button', { name: '필터' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
```

### Step 2: 테스트 실행 → 실패 확인

```bash
pnpm jest src/features/map/components/__tests__/FilterButton.test.tsx
```

Expected: FAIL (모듈 없음)

### Step 3: 최소 구현

```tsx
// src/features/map/components/FilterButton.tsx
import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { AppText } from '@/shared/components/AppText';
import { pressedOpacity } from '@/shared/lib/pressable';
import { colors } from '@/shared/theme/tokens';

interface FilterButtonProps {
  activeCount: number;
  onPress: () => void;
}

export function FilterButton({ activeCount, onPress }: FilterButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="필터"
      style={pressedOpacity}
      className="relative items-center justify-center w-10 h-10 rounded-full bg-bg-elevated shadow-sm"
    >
      <MaterialIcons name="tune" size={20} color={colors.text.primary} />
      {activeCount > 0 && (
        <View
          testID="filter-badge"
          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-accent items-center justify-center"
        >
          <AppText className="text-text-inverse font-bold" style={{ fontSize: 10 }}>
            {String(activeCount)}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}
```

### Step 4: 테스트 실행 → 통과 확인

```bash
pnpm jest src/features/map/components/__tests__/FilterButton.test.tsx
```

Expected: PASS (4 tests)

### Step 5: 커밋

```bash
git add src/features/map/components/FilterButton.tsx \
        src/features/map/components/__tests__/FilterButton.test.tsx
git commit -m "feat(map): add FilterButton with active count badge"
```

---

## Task 2: FilterPanel 컴포넌트 (TDD)

**Files:**

- Create: `src/features/map/components/FilterPanel.tsx`
- Create: `src/features/map/components/__tests__/FilterPanel.test.tsx`

**Note:** 애니메이션(Reanimated)은 Jest에서 테스트하지 않는다. 패널 내부 렌더링 로직(브랜드/카테고리 chip 표시, 선택 상태, 콜백)만 테스트한다.

### Step 1: 실패하는 테스트 작성

```tsx
// src/features/map/components/__tests__/FilterPanel.test.tsx
import { fireEvent, render } from '@testing-library/react-native';
import type { Brand, Category, SearchFilters } from '@/shared/types/database';
import { FilterPanel } from '../FilterPanel';

const brands: Brand[] = [
  { id: 'b-1', name: 'Hammer Strength', created_at: '', updated_at: '' },
  { id: 'b-2', name: 'Panatta', created_at: '', updated_at: '' },
];

const categories: Category[] = [
  { id: 'c-1', name: '등', created_at: '', updated_at: '' },
  { id: 'c-2', name: '가슴', created_at: '', updated_at: '' },
];

const noFilters: SearchFilters = { brandId: null, categoryId: null, loadingType: null };

describe('FilterPanel', () => {
  it('renders brand chips', () => {
    const { getByText } = render(
      <FilterPanel
        visible={true}
        brands={brands}
        categories={categories}
        filters={noFilters}
        onBrandChange={() => undefined}
        onCategoryChange={() => undefined}
        onClose={() => undefined}
      />,
    );
    expect(getByText('Hammer Strength')).toBeTruthy();
    expect(getByText('Panatta')).toBeTruthy();
  });

  it('renders category chips', () => {
    const { getByText } = render(
      <FilterPanel
        visible={true}
        brands={brands}
        categories={categories}
        filters={noFilters}
        onBrandChange={() => undefined}
        onCategoryChange={() => undefined}
        onClose={() => undefined}
      />,
    );
    expect(getByText('등')).toBeTruthy();
    expect(getByText('가슴')).toBeTruthy();
  });

  it('calls onBrandChange with brand id when brand chip pressed', () => {
    const onBrandChange = jest.fn();
    const { getByText } = render(
      <FilterPanel
        visible={true}
        brands={brands}
        categories={categories}
        filters={noFilters}
        onBrandChange={onBrandChange}
        onCategoryChange={() => undefined}
        onClose={() => undefined}
      />,
    );
    fireEvent.press(getByText('Hammer Strength'));
    expect(onBrandChange).toHaveBeenCalledWith('b-1');
  });

  it('calls onBrandChange with null when selected brand is pressed again', () => {
    const onBrandChange = jest.fn();
    const { getByText } = render(
      <FilterPanel
        visible={true}
        brands={brands}
        categories={categories}
        filters={{ ...noFilters, brandId: 'b-1' }}
        onBrandChange={onBrandChange}
        onCategoryChange={() => undefined}
        onClose={() => undefined}
      />,
    );
    fireEvent.press(getByText('Hammer Strength'));
    expect(onBrandChange).toHaveBeenCalledWith(null);
  });

  it('calls onCategoryChange with category id when category chip pressed', () => {
    const onCategoryChange = jest.fn();
    const { getByText } = render(
      <FilterPanel
        visible={true}
        brands={brands}
        categories={categories}
        filters={noFilters}
        onBrandChange={() => undefined}
        onCategoryChange={onCategoryChange}
        onClose={() => undefined}
      />,
    );
    fireEvent.press(getByText('등'));
    expect(onCategoryChange).toHaveBeenCalledWith('c-1');
  });

  it('calls onClose when backdrop is pressed', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <FilterPanel
        visible={true}
        brands={brands}
        categories={categories}
        filters={noFilters}
        onBrandChange={() => undefined}
        onCategoryChange={() => undefined}
        onClose={onClose}
      />,
    );
    fireEvent.press(getByTestId('filter-panel-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders section labels', () => {
    const { getByText } = render(
      <FilterPanel
        visible={true}
        brands={brands}
        categories={categories}
        filters={noFilters}
        onBrandChange={() => undefined}
        onCategoryChange={() => undefined}
        onClose={() => undefined}
      />,
    );
    expect(getByText('브랜드')).toBeTruthy();
    expect(getByText('머신 종류')).toBeTruthy();
  });
});
```

### Step 2: 테스트 실행 → 실패 확인

```bash
pnpm jest src/features/map/components/__tests__/FilterPanel.test.tsx
```

Expected: FAIL

### Step 3: 최소 구현

```tsx
// src/features/map/components/FilterPanel.tsx
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { AppText } from '@/shared/components/AppText';
import { Chip } from '@/shared/components/Chip';
import { ANIMATION } from '@/shared/theme/tokens';
import type { Brand, Category, SearchFilters } from '@/shared/types/database';

interface FilterPanelProps {
  visible: boolean;
  brands: readonly Brand[];
  categories: readonly Category[];
  filters: SearchFilters;
  onBrandChange: (brandId: string | null) => void;
  onCategoryChange: (categoryId: string | null) => void;
  onClose: () => void;
}

const PANEL_DURATION = ANIMATION.microDuration;

export function FilterPanel({
  visible,
  brands,
  categories,
  filters,
  onBrandChange,
  onCategoryChange,
  onClose,
}: FilterPanelProps) {
  const progress = useSharedValue(visible ? 1 : 0);

  // Sync visible → animation
  if (visible && progress.value === 0) {
    progress.value = withTiming(1, { duration: PANEL_DURATION });
  } else if (!visible && progress.value === 1) {
    progress.value = withTiming(0, { duration: PANEL_DURATION });
  }

  const panelStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * -8 }],
  }));

  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <Pressable testID="filter-panel-backdrop" onPress={onClose} className="absolute inset-0" />
      {/* Panel */}
      <Animated.View
        style={panelStyle}
        className="mx-4 mt-2 rounded-2xl bg-bg-elevated shadow-md p-4 gap-4"
      >
        {brands.length > 0 && (
          <View className="gap-2">
            <AppText className="font-semibold text-body-sm text-text-secondary">브랜드</AppText>
            <View className="flex-row flex-wrap gap-2">
              {brands.map((brand) => (
                <Chip
                  key={brand.id}
                  label={brand.name}
                  selected={filters.brandId === brand.id}
                  onPress={() => {
                    onBrandChange(filters.brandId === brand.id ? null : brand.id);
                  }}
                />
              ))}
            </View>
          </View>
        )}
        {categories.length > 0 && (
          <View className="gap-2">
            <AppText className="font-semibold text-body-sm text-text-secondary">머신 종류</AppText>
            <View className="flex-row flex-wrap gap-2">
              {categories.map((category) => (
                <Chip
                  key={category.id}
                  label={category.name}
                  selected={filters.categoryId === category.id}
                  onPress={() => {
                    onCategoryChange(filters.categoryId === category.id ? null : category.id);
                  }}
                />
              ))}
            </View>
          </View>
        )}
      </Animated.View>
    </>
  );
}
```

### Step 4: 테스트 실행 → 통과 확인

```bash
pnpm jest src/features/map/components/__tests__/FilterPanel.test.tsx
```

Expected: PASS (7 tests)

### Step 5: 커밋

```bash
git add src/features/map/components/FilterPanel.tsx \
        src/features/map/components/__tests__/FilterPanel.test.tsx
git commit -m "feat(map): add FilterPanel with brand/category sections"
```

---

## Task 3: MapScreen 통합 + FilterBar 삭제

**Files:**

- Modify: `src/features/map/components/MapScreen.tsx`
- Delete: `src/features/map/components/FilterBar.tsx`
- Delete: `src/features/map/components/__tests__/FilterBar.test.tsx`

**Note:** MapScreen은 Jest에서 렌더링하지 않는다 (NaverMapView OOM — `docs/harness/lessons.md` 참고). 이 태스크는 수동 스모크 테스트로 검증한다.

### Step 1: FilterBar 삭제

```bash
git rm src/features/map/components/FilterBar.tsx
git rm src/features/map/components/__tests__/FilterBar.test.tsx
```

### Step 2: MapScreen 수정

`MapScreen.tsx`에서:

1. `FilterBar` import 제거
2. `FilterButton`, `FilterPanel` import 추가
3. `filterPanelOpen` state 추가 (`useState(false)`)
4. `activeFilterCount` 계산 추가 (brandId + categoryId 각 1씩)
5. FilterBar `<View>` 블록을 FilterButton + FilterPanel로 교체
6. `NaverMapView`의 `onCameraIdle`에서 패널 닫기 추가

```tsx
// 추가할 state
const [filterPanelOpen, setFilterPanelOpen] = useState(false);

// 활성 필터 수 계산
const activeFilterCount =
  (filters.brandId !== null ? 1 : 0) + (filters.categoryId !== null ? 1 : 0);

// handleCameraIdle 수정 — 카메라 이동 시 패널 닫기
function handleCameraIdle({ region }: { region: Region }) {
  setFilterPanelOpen(false);
  const newBounds = regionToMapBounds(region);
  setBounds(newBounds);
  if (searchBounds === null) {
    setSearchBounds(newBounds);
  }
}

// JSX 교체
// 기존:
// <View className="absolute top-safe-or-4 left-0 right-0 z-10">
//   <FilterBar ... />
// </View>

// 변경 후:
<View className="absolute top-safe-or-4 right-4 z-10">
  <FilterButton
    activeCount={activeFilterCount}
    onPress={() => { setFilterPanelOpen((prev) => !prev); }}
  />
</View>

<View className="absolute top-safe-or-16 left-0 right-0 z-20">
  <FilterPanel
    visible={filterPanelOpen}
    brands={brands}
    categories={categories}
    filters={filters}
    onBrandChange={setBrand}
    onCategoryChange={setCategory}
    onClose={() => { setFilterPanelOpen(false); }}
  />
</View>
```

### Step 3: lint + tsc 확인

```bash
pnpm lint && pnpm exec tsc --noEmit
```

Expected: 0 errors

### Step 4: 전체 테스트 확인

```bash
pnpm jest
```

Expected: FilterBar 테스트 제거로 6개 감소, 나머지 PASS. Coverage threshold 통과 확인.

### Step 5: 커밋

```bash
git add src/features/map/components/MapScreen.tsx
git commit -m "feat(map): replace FilterBar with FilterButton + FilterPanel"
```

---

## Task 4: jest.config.js coverage 제외 정리

FilterBar가 삭제됐으므로 이전에 추가한 coverage 제외 목록과 충돌이 없는지 확인한다. 변경 필요 없으면 그대로 두고 커밋 없이 넘어간다.

```bash
pnpm jest --coverage 2>&1 | grep -E "threshold|FilterBar"
```

FilterBar 관련 라인이 없으면 완료.

---

## 검증 체크리스트

- [ ] `pnpm lint` — 0 issues
- [ ] `pnpm exec tsc --noEmit` — 0 errors
- [ ] `pnpm jest` — 모든 테스트 통과, coverage ≥ 80%
- [ ] 시뮬레이터: 필터 버튼 탭 → 패널 슬라이드다운
- [ ] 시뮬레이터: 브랜드 칩 선택 → 버튼 뱃지 "1" 표시
- [ ] 시뮬레이터: 지도 드래그 → 패널 자동 닫힘
- [ ] 시뮬레이터: 백드롭 탭 → 패널 닫힘
- [ ] `/verify` (FF review 포함)
