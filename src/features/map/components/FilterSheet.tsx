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
import type { Brand, Category, MapBounds, SearchFilters } from '@/shared/types/database';

import { FilterSheetApplyBar } from './FilterSheetApplyBar';
import { FilterSheetBrandAccordion } from './FilterSheetBrandAccordion';
import { FilterSheetSection } from './FilterSheetSection';
import { FilterSheetSelectionStrip } from './FilterSheetSelectionStrip';
import { INITIAL_FILTERS } from '../hooks/useFilters';
import { useSeries } from '../hooks/useSeries';
import { useTemplateCounts } from '../hooks/useTemplateCounts';
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
  /**
   * Currently committed filters from `useFilters` — the sheet syncs its
   * staged state to this whenever the sheet (re-)opens, so an NL search
   * applying parsedFilters between two sheet sessions surfaces as the
   * pre-filled staged state the next time the user opens the filter.
   */
  filters: SearchFilters;
  /**
   * Phase 5 item 23 follow-up: chip taps no longer mutate the parent's
   * `filters` directly — they stage local changes inside this sheet, and
   * this callback fires only when the user taps the 필터 적용하기 CTA.
   * Eliminates the per-toggle gym-search refetch (which wasted Render
   * quota and caused transient list flicker mid-edit).
   */
  onApply: (next: SearchFilters) => void;
  onDismiss?: () => void;
  /**
   * Last searched bbox from the map. Drives the per-template "nearby gyms"
   * badge counts; `null` (no search yet) leaves badges off and shows every
   * row, so the filter is never empty before the first search.
   */
  bounds?: MapBounds | null;
  testID?: string;
}

function filtersEqual(a: SearchFilters, b: SearchFilters): boolean {
  if (a.machineFilterMode !== b.machineFilterMode) return false;
  if (a.brandIds.length !== b.brandIds.length) return false;
  if (a.categoryIds.length !== b.categoryIds.length) return false;
  if (a.templateIds.length !== b.templateIds.length) return false;
  for (let i = 0; i < a.brandIds.length; i++) {
    if (a.brandIds[i] !== b.brandIds[i]) return false;
  }
  for (let i = 0; i < a.categoryIds.length; i++) {
    if (a.categoryIds[i] !== b.categoryIds[i]) return false;
  }
  for (let i = 0; i < a.templateIds.length; i++) {
    if (a.templateIds[i] !== b.templateIds[i]) return false;
  }
  return true;
}

function toggleInArray(list: readonly string[], id: string): readonly string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

/**
 * Phase 5 item 23 / ADR 0024 + 2026-05-22 follow-up: brand-first accordion
 * FilterSheet with staged-edit semantics.
 *
 * Staged-edit lifecycle (the 2026-05-22 follow-up):
 *   - `stagedFilters` starts equal to the externally-committed `filters`.
 *   - The sheet `onChange(index)` callback re-syncs `staged := filters`
 *     each time the sheet opens, so any external change (NL search apply,
 *     parent state reset) appears as the new starting point. Re-opening
 *     after a dismissal without 적용 drops the user's edits cleanly.
 *   - Apply CTA fires `onApply(staged)`; Reset CTA sets
 *     `staged := INITIAL_FILTERS` (still local — user must tap Apply to
 *     commit empty state).
 *   - Dismiss (X / pan-down / backdrop tap) leaves the committed filters
 *     untouched; the next open will overwrite the dropped staged state.
 *
 * `useFilters` state shape is unchanged. The backend's `searchInBounds`
 * DTO is unchanged. Only the FilterSheet ↔ MapScreen prop boundary
 * changed from "many small toggles" to a single `onApply` callback.
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
    onApply,
    onDismiss,
    bounds = null,
    testID,
  },
  ref,
) {
  const sheetRef = useRef<React.ComponentRef<typeof BottomSheetModal>>(null);
  const insets = useSafeAreaInsets();
  const [stagedFilters, setStagedFilters] = useState<SearchFilters>(filters);
  const [expandedBrandIds, setExpandedBrandIds] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const [searchQuery, setSearchQuery] = useState('');
  const wasVisibleRef = useRef(false);

  useImperativeHandle(
    ref,
    () => ({
      present: () => sheetRef.current?.present(),
      dismiss: () => sheetRef.current?.dismiss(),
    }),
    [],
  );

  const { data: series = [] } = useSeries();
  const { data: templateCounts } = useTemplateCounts(bounds);
  const countsActive = templateCounts !== undefined;

  const brandGroups = useMemo(
    () =>
      groupTemplatesByBrand({
        brands,
        categories,
        series,
        templates: machineTemplates,
        activeCategoryIds: stagedFilters.categoryIds,
        searchQuery,
        counts: templateCounts,
      }),
    [
      brands,
      categories,
      series,
      machineTemplates,
      stagedFilters.categoryIds,
      searchQuery,
      templateCounts,
    ],
  );

  // Q2 / NL auto-expand: when staged templateIds picked up an externally
  // applied template (e.g. previous Apply or NL pre-fill), expand the
  // owning brand so the user lands inside the relevant accordion.
  useEffect(
    function autoExpandFromSelectedTemplates() {
      if (stagedFilters.templateIds.length === 0) return;
      const brandIdsForSelection = new Set<string>();
      for (const templateId of stagedFilters.templateIds) {
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
    [stagedFilters.templateIds, machineTemplates],
  );

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

  function handleSheetChange(index: number) {
    const isVisible = index >= 0;
    // Open transition (closed → open): re-sync staged from committed so
    // any external apply (NL search, parent reset) becomes the new
    // baseline and the previous edit session's dropped staged state
    // doesn't leak in.
    if (isVisible && !wasVisibleRef.current) {
      setStagedFilters(filters);
    }
    wasVisibleRef.current = isVisible;
  }

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

  function handleToggleCategory(categoryId: string) {
    setStagedFilters((prev) => ({
      ...prev,
      categoryIds: toggleInArray(prev.categoryIds, categoryId),
    }));
  }

  function handleToggleTemplate(templateId: string) {
    setStagedFilters((prev) => ({
      ...prev,
      templateIds: toggleInArray(prev.templateIds, templateId),
    }));
  }

  function handleSetMachineFilterMode(mode: SearchFilters['machineFilterMode']) {
    setStagedFilters((prev) => ({ ...prev, machineFilterMode: mode }));
  }

  function handleResetAll() {
    setStagedFilters(INITIAL_FILTERS);
  }

  function handleApply() {
    onApply(stagedFilters);
    sheetRef.current?.dismiss();
  }

  function handleClose() {
    sheetRef.current?.dismiss();
  }

  function handleSearchFocus() {
    sheetRef.current?.snapToIndex(SNAP_INDEX_FULL);
  }

  function handleSearchClear() {
    setSearchQuery('');
  }

  const hasPendingChanges = !filtersEqual(stagedFilters, filters);
  const footerBottomPadding = Math.max(insets.bottom, MIN_FOOTER_BOTTOM_PADDING);

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={SNAP_POINTS}
      enablePanDownToClose
      backgroundStyle={BACKGROUND_STYLE}
      backdropComponent={renderBackdrop}
      onChange={handleSheetChange}
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
              selectedIds={stagedFilters.categoryIds}
              isError={categoriesError}
              searchThreshold={CATEGORY_SEARCH_THRESHOLD}
              searchPlaceholder=""
              onToggle={handleToggleCategory}
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
              selectedTemplateIds={stagedFilters.templateIds}
              countsActive={countsActive}
              onToggleExpand={toggleExpand}
              onToggleTemplate={handleToggleTemplate}
            />
          )}
        </BottomSheetScrollView>

        <FilterSheetSelectionStrip
          selectedTemplateIds={stagedFilters.templateIds}
          templates={machineTemplates}
          machineFilterMode={stagedFilters.machineFilterMode}
          onRemoveTemplate={handleToggleTemplate}
          onSetMachineFilterMode={handleSetMachineFilterMode}
        />

        <View style={{ paddingBottom: footerBottomPadding }}>
          <FilterSheetApplyBar
            hasPendingChanges={hasPendingChanges}
            onResetAll={handleResetAll}
            onApply={handleApply}
          />
        </View>
      </View>
    </BottomSheetModal>
  );
});
