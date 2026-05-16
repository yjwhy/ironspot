import { MaterialIcons } from '@expo/vector-icons';
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/shared/components/AppText';
import { SegmentedControl } from '@/shared/components/SegmentedControl';
import { pressedOpacity } from '@/shared/lib/pressable';
import { colors } from '@/shared/theme/tokens';
import type { Brand, Category, LoadingType, SearchFilters } from '@/shared/types/database';

import { ActiveFilterStrip } from './ActiveFilterStrip';
import { FilterSheetSection } from './FilterSheetSection';
import { type ActiveFilter, toActiveFilters } from '../lib/active-filters';

const SNAP_POINTS = ['65%', '90%'];
const BACKGROUND_STYLE = { backgroundColor: colors.bg.elevated };
const SEARCH_THRESHOLD = 8;
const MIN_FOOTER_BOTTOM_PADDING = 16;

const LOADING_SEGMENTS = [
  { label: '전체', value: null },
  { label: '핀로딩', value: 'pin' },
  { label: '플레이트', value: 'plate' },
] as const satisfies readonly { label: string; value: LoadingType | null }[];

export interface FilterSheetRef {
  present: () => void;
  dismiss: () => void;
}

interface FilterSheetProps {
  brands: readonly Brand[];
  categories: readonly Category[];
  brandsError?: boolean;
  categoriesError?: boolean;
  filters: SearchFilters;
  onToggleBrand: (brandId: string) => void;
  onToggleCategory: (categoryId: string) => void;
  onSetLoadingType: (loadingType: LoadingType | null) => void;
  onResetAll: () => void;
  onDismiss?: () => void;
  testID?: string;
}

export const FilterSheet = forwardRef<FilterSheetRef, FilterSheetProps>(function FilterSheet(
  {
    brands,
    categories,
    brandsError = false,
    categoriesError = false,
    filters,
    onToggleBrand,
    onToggleCategory,
    onSetLoadingType,
    onResetAll,
    onDismiss,
    testID,
  },
  ref,
) {
  const sheetRef = useRef<React.ComponentRef<typeof BottomSheetModal>>(null);
  const insets = useSafeAreaInsets();

  useImperativeHandle(
    ref,
    () => ({
      present: () => sheetRef.current?.present(),
      dismiss: () => sheetRef.current?.dismiss(),
    }),
    [],
  );

  const activeFilters = useMemo(
    () => toActiveFilters({ filters, brands, categories }),
    [filters, brands, categories],
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />
    ),
    [],
  );

  function handleRemoveActive(filter: ActiveFilter) {
    if (filter.kind === 'brand') {
      onToggleBrand(filter.id);
      return;
    }
    if (filter.kind === 'category') {
      onToggleCategory(filter.id);
      return;
    }
    onSetLoadingType(null);
  }

  function handleClose() {
    sheetRef.current?.dismiss();
  }

  const footerBottomPadding = Math.max(insets.bottom, MIN_FOOTER_BOTTOM_PADDING);
  const hasActiveFilters = activeFilters.length > 0;

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={SNAP_POINTS}
      enablePanDownToClose
      backgroundStyle={BACKGROUND_STYLE}
      backdropComponent={renderBackdrop}
      onDismiss={onDismiss}
    >
      <View testID={testID} className="flex-1">
        <View className="flex-row items-center justify-between px-5 pb-3 pt-2">
          <AppText className="text-heading-md font-semibold text-text-primary">필터</AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="필터 닫기"
            onPress={handleClose}
            style={pressedOpacity}
            className="-m-2 p-2"
          >
            <MaterialIcons name="close" size={24} color={colors.text.primary} />
          </Pressable>
        </View>

        <BottomSheetScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16, gap: 16 }}
        >
          <View className="gap-2">
            <AppText className="text-body-md font-semibold text-text-primary">로딩 방식</AppText>
            <SegmentedControl
              segments={LOADING_SEGMENTS}
              value={filters.loadingType}
              onChange={onSetLoadingType}
              accessibilityLabel="로딩 방식"
            />
          </View>

          {hasActiveFilters ? (
            <ActiveFilterStrip filters={activeFilters} onRemove={handleRemoveActive} />
          ) : null}

          <FilterSheetSection
            label="브랜드"
            items={brands}
            selectedIds={filters.brandIds}
            isError={brandsError}
            searchThreshold={SEARCH_THRESHOLD}
            searchPlaceholder="브랜드 검색"
            onToggle={onToggleBrand}
          />

          <FilterSheetSection
            label="머신 종류"
            items={categories}
            selectedIds={filters.categoryIds}
            isError={categoriesError}
            searchThreshold={SEARCH_THRESHOLD}
            searchPlaceholder="머신 종류 검색"
            onToggle={onToggleCategory}
          />
        </BottomSheetScrollView>

        {hasActiveFilters ? (
          <View
            className="flex-row items-center justify-between border-t border-border bg-bg-elevated px-5 pt-3"
            style={{ paddingBottom: footerBottomPadding }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="필터 전체 해제"
              onPress={onResetAll}
              style={pressedOpacity}
              className="h-10 justify-center"
            >
              <AppText className="text-body-md font-medium text-accent">전체 해제</AppText>
            </Pressable>
            <AppText className="text-body-sm text-text-tertiary">
              {`${String(activeFilters.length)}개 활성`}
            </AppText>
          </View>
        ) : null}
      </View>
    </BottomSheetModal>
  );
});
