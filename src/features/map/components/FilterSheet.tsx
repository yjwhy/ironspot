import { MaterialIcons } from '@expo/vector-icons';
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
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
const SNAP_INDEX_FULL = 1;
const BACKGROUND_STYLE = { backgroundColor: colors.bg.elevated };
const MIN_FOOTER_BOTTOM_PADDING = 16;
// 6 categories — keep threshold high so FilterSheetSection skips its inline
// search input. The global search bar at the sheet top covers cross-dimension
// search across brands + machines (categories are short enough to skim).
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
 * Phase 5 item 23 / ADR 0024: brand-first accordion FilterSheet.
 *
 * Body composition:
 *   - 운동 부위 chip row (top, optional cross-filter — Q3 narrows accordion
 *     contents AND brand-row counts to the chip selection).
 *   - Global search input (always visible, Q8-extra: focusing snaps the
 *     sheet to its max snap so the keyboard never hides the chip list).
 *     Query matches `brand.name` ∪ `template.nameKo` ∪ `template.nameEn`
 *     case-insensitively — Q1 hides unmatched brands and auto-expands the
 *     matched ones.
 *   - Brand accordion (body).
 *   - Selection footer strip (sticky bottom, surfaces only when ≥1 machine
 *     is selected; Q4 hosts the "전체 보유" Switch once ≥2 are selected).
 *
 * Expand state lifecycle (Q6 + Q2):
 *   - Persists locally inside this component across sheet open/close.
 *   - `filters.templateIds` changes (NL search applies a parsedFilters
 *     payload, or user starts the sheet with templates pre-selected) merge
 *     the matching brand ids into the expanded set so the user lands inside
 *     the relevant accordions without manual taps.
 *   - Active search query replaces the visible expand set with every
 *     visible brand — when the user clears the query the manual expand
 *     state restores cleanly.
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
  const [expandedBrandIds, setExpandedBrandIds] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const [searchQuery, setSearchQuery] = useState('');

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
        searchQuery,
      }),
    [brands, categories, machineTemplates, filters.categoryIds, searchQuery],
  );

  // Q2 / NL auto-expand: whenever the externally-set templateIds change
  // (NL search applied parsedFilters, or a parent set the value pre-mount),
  // ensure the brands that own those templates are in the expanded set so
  // the user lands inside the relevant accordions. Merge-only — never
  // auto-collapses, so a user expanding manually and then receiving an NL
  // result preserves both sets.
  useEffect(
    function autoExpandFromSelectedTemplates() {
      if (filters.templateIds.length === 0) return;
      const brandIdsForSelection = new Set<string>();
      for (const templateId of filters.templateIds) {
        const template = machineTemplates.find((t) => t.id === templateId);
        if (template !== undefined) brandIdsForSelection.add(template.brandId);
      }
      if (brandIdsForSelection.size === 0) return;
      setExpandedBrandIds((prev) => {
        let next = prev;
        let mutated = false;
        for (const brandId of brandIdsForSelection) {
          if (!next.has(brandId)) {
            if (!mutated) {
              next = new Set(prev);
              mutated = true;
            }
            (next as Set<string>).add(brandId);
          }
        }
        return mutated ? next : prev;
      });
    },
    [filters.templateIds, machineTemplates],
  );

  // While search is active, every visible brand reveals its matching
  // templates by default so the user can scan results without an extra
  // tap. Clearing the query falls back to the user's saved expand set.
  const isSearching = searchQuery.trim() !== '';
  const displayedExpandedBrandIds = useMemo(() => {
    if (!isSearching) return expandedBrandIds;
    const next = new Set<string>();
    for (const group of brandGroups) next.add(group.brand.id);
    return next;
  }, [isSearching, brandGroups, expandedBrandIds]);

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

  function handleSearchFocus() {
    // Q8-extra: snap to full so the keyboard never hides the brand list.
    sheetRef.current?.snapToIndex(SNAP_INDEX_FULL);
  }

  function handleSearchClear() {
    setSearchQuery('');
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

        <View className="px-5 pb-3">
          <View className="flex-row items-center gap-2 rounded-lg bg-bg-muted px-3 py-2">
            <MaterialIcons name="search" size={16} color={colors.text.tertiary} />
            <BottomSheetTextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={handleSearchFocus}
              placeholder="머신 또는 브랜드 검색"
              placeholderTextColor={colors.text.tertiary}
              returnKeyType="search"
              accessibilityLabel="머신 또는 브랜드 검색"
              testID="filter-sheet-global-search"
              style={{ flex: 1, color: colors.text.primary, fontSize: 14 }}
            />
            {isSearching ? (
              <Pressable
                onPress={handleSearchClear}
                accessibilityRole="button"
                accessibilityLabel="검색어 지우기"
                hitSlop={8}
                style={pressedOpacity}
              >
                <MaterialIcons name="close" size={16} color={colors.text.secondary} />
              </Pressable>
            ) : null}
          </View>
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
              expandedBrandIds={displayedExpandedBrandIds}
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
