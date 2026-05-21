import { MaterialIcons } from '@expo/vector-icons';
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/shared/components/AppText';
import type { MachineTemplateResponse } from '@/shared/generated/model';
import { pressedOpacity } from '@/shared/lib/pressable';
import { colors } from '@/shared/theme/tokens';
import type { Brand, Category, SearchFilters } from '@/shared/types/database';

import { FilterSheetBrandAccordion } from './FilterSheetBrandAccordion';
import { FilterSheetSection } from './FilterSheetSection';
import { FilterSheetSelectionStrip } from './FilterSheetSelectionStrip';
import { groupTemplatesByBrand } from '../lib/group-templates-by-brand';

const SNAP_POINTS = ['65%', '90%'];
const BACKGROUND_STYLE = { backgroundColor: colors.bg.elevated };
const MIN_FOOTER_BOTTOM_PADDING = 16;
// 6 categories — no search box needed; keep threshold high so FilterSheetSection
// skips the inline search input. Slice b will replace the category section with
// a dedicated chip row + global search bar at the top of the sheet.
const CATEGORY_SEARCH_THRESHOLD = 999;

export interface FilterSheetRef {
  present: () => void;
  dismiss: () => void;
}

interface FilterSheetProps {
  brands: readonly Brand[];
  categories: readonly Category[];
  machineTemplates: readonly MachineTemplateResponse[];
  brandsError?: boolean;
  categoriesError?: boolean;
  machineTemplatesError?: boolean;
  filters: SearchFilters;
  onToggleBrand: (brandId: string) => void;
  onToggleCategory: (categoryId: string) => void;
  onToggleTemplate: (templateId: string) => void;
  onSetMachineFilterMode: (mode: SearchFilters['machineFilterMode']) => void;
  onResetAll: () => void;
  onDismiss?: () => void;
  testID?: string;
}

/**
 * Phase 5 item 23 / ADR 0024 (slice a): the FilterSheet now renders a
 * brand-first accordion as the body instead of three orthogonal chip
 * sections. The 운동 부위 chips stay above the accordion as a quick
 * cross-filter; the brand-only chip section is gone (brand selection is now
 * implicit — expand a brand and pick its machines). A footer strip below
 * the scrollable body collects the selected machine chips and hosts the
 * AND/OR "전체 보유" toggle once ≥2 machines are selected.
 *
 * Slice b layers in the global search input + 운동 부위 cross-filter
 * narrowing + NL search auto-expand. Slice c adds motion + a11y polish.
 *
 * `useFilters` state shape is unchanged — only the UI layer changes. The
 * backend's `searchInBounds` DTO (brandIds + categoryIds + templateIds +
 * scope) is unchanged, matching ADR 0024's "no backend change" promise.
 */
export const FilterSheet = forwardRef<FilterSheetRef, FilterSheetProps>(function FilterSheet(
  {
    brands,
    categories,
    machineTemplates,
    brandsError = false,
    categoriesError = false,
    machineTemplatesError: _machineTemplatesError = false,
    filters,
    onToggleBrand: _onToggleBrand,
    onToggleCategory,
    onToggleTemplate,
    onSetMachineFilterMode,
    onResetAll,
    onDismiss,
    testID,
  },
  ref,
) {
  const sheetRef = useRef<React.ComponentRef<typeof BottomSheetModal>>(null);
  const insets = useSafeAreaInsets();
  // Q6 decision: local expand state, persisted across sheet open/close while
  // MapScreen is mounted. NL search will replace this set (slice b).
  const [expandedBrandIds, setExpandedBrandIds] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );

  useImperativeHandle(
    ref,
    () => ({
      present: () => sheetRef.current?.present(),
      dismiss: () => sheetRef.current?.dismiss(),
    }),
    [],
  );

  const brandGroups = useMemo(
    () =>
      groupTemplatesByBrand({
        brands,
        categories,
        templates: machineTemplates,
        activeCategoryIds: filters.categoryIds,
      }),
    [brands, categories, machineTemplates, filters.categoryIds],
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />
    ),
    [],
  );

  function toggleExpand(brandId: string) {
    setExpandedBrandIds((prev) => {
      const next = new Set(prev);
      if (next.has(brandId)) {
        next.delete(brandId);
      } else {
        next.add(brandId);
      }
      return next;
    });
  }

  function handleClose() {
    sheetRef.current?.dismiss();
  }

  const footerBottomPadding = Math.max(insets.bottom, MIN_FOOTER_BOTTOM_PADDING);

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

        <BottomSheetScrollView contentContainerStyle={{ paddingBottom: 16 }}>
          <View className="gap-4 px-5 pb-3">
            <FilterSheetSection
              label="운동 부위"
              items={categories}
              selectedIds={filters.categoryIds}
              isError={categoriesError}
              searchThreshold={CATEGORY_SEARCH_THRESHOLD}
              searchPlaceholder=""
              onToggle={onToggleCategory}
            />
          </View>

          {brandsError ? (
            <View className="items-center px-4 py-12">
              <MaterialIcons name="error-outline" size={32} color={colors.text.tertiary} />
              <AppText className="mt-3 text-center text-body-sm text-text-secondary">
                브랜드 정보를 불러오지 못했어요
              </AppText>
            </View>
          ) : (
            <FilterSheetBrandAccordion
              groups={brandGroups}
              expandedBrandIds={expandedBrandIds}
              selectedTemplateIds={filters.templateIds}
              onToggleExpand={toggleExpand}
              onToggleTemplate={onToggleTemplate}
            />
          )}
        </BottomSheetScrollView>

        <View style={{ paddingBottom: footerBottomPadding }}>
          <FilterSheetSelectionStrip
            selectedTemplateIds={filters.templateIds}
            templates={machineTemplates}
            machineFilterMode={filters.machineFilterMode}
            onRemoveTemplate={onToggleTemplate}
            onResetAll={onResetAll}
            onSetMachineFilterMode={onSetMachineFilterMode}
          />
        </View>
      </View>
    </BottomSheetModal>
  );
});
