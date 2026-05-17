import { MaterialIcons } from '@expo/vector-icons';
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/shared/components/AppText';
import type { MachineTemplateResponse } from '@/shared/generated/model';
import { pressedOpacity } from '@/shared/lib/pressable';
import { colors } from '@/shared/theme/tokens';
import type { Brand, Category, SearchFilters } from '@/shared/types/database';

import { ActiveFilterStrip } from './ActiveFilterStrip';
import { FilterSheetSection } from './FilterSheetSection';
import {
  type ActiveFilter,
  formatMachineTemplateLabel,
  toActiveFilters,
} from '../lib/active-filters';

const SNAP_POINTS = ['65%', '90%'];
const BACKGROUND_STYLE = { backgroundColor: colors.bg.elevated };
const SEARCH_THRESHOLD = 8;
const MACHINE_SECTION_SEARCH_THRESHOLD = 0; // ADR 0022: always show search
const MIN_FOOTER_BOTTOM_PADDING = 16;
const AND_TOGGLE_MIN_SELECTION = 2;

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

export const FilterSheet = forwardRef<FilterSheetRef, FilterSheetProps>(function FilterSheet(
  {
    brands,
    categories,
    machineTemplates,
    brandsError = false,
    categoriesError = false,
    machineTemplatesError = false,
    filters,
    onToggleBrand,
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

  useImperativeHandle(
    ref,
    () => ({
      present: () => sheetRef.current?.present(),
      dismiss: () => sheetRef.current?.dismiss(),
    }),
    [],
  );

  // ADR 0022: machine chip labels include brand prefix + loading suffix.
  // Project the template list into the {id, name} shape that FilterSheetSection
  // expects, with the rich label as the name.
  const machineSectionItems = useMemo(
    () =>
      machineTemplates.map((template) => ({
        id: template.id,
        name: formatMachineTemplateLabel(template),
      })),
    [machineTemplates],
  );

  const activeFilters = useMemo(
    () => toActiveFilters({ filters, brands, categories, machineTemplates }),
    [filters, brands, categories, machineTemplates],
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />
    ),
    [],
  );

  function handleRemoveActive(filter: ActiveFilter) {
    switch (filter.kind) {
      case 'brand':
        onToggleBrand(filter.id);
        return;
      case 'category':
        onToggleCategory(filter.id);
        return;
      case 'machineTemplate':
        onToggleTemplate(filter.id);
        return;
      default: {
        // Exhaustive check — adding a new ActiveFilterKind triggers TS error here.
        const _exhaustive: never = filter.kind;
        throw new Error(`Unhandled active filter kind: ${String(_exhaustive)}`);
      }
    }
  }

  function handleClose() {
    sheetRef.current?.dismiss();
  }

  function handleAndModeToggle(value: boolean) {
    onSetMachineFilterMode(value ? 'and' : 'or');
  }

  const footerBottomPadding = Math.max(insets.bottom, MIN_FOOTER_BOTTOM_PADDING);
  const hasActiveFilters = activeFilters.length > 0;
  const showAndToggle = filters.templateIds.length >= AND_TOGGLE_MIN_SELECTION;
  const andModeOn = filters.machineFilterMode === 'and';

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
          {hasActiveFilters ? (
            <ActiveFilterStrip filters={activeFilters} onRemove={handleRemoveActive} />
          ) : null}

          <FilterSheetSection
            label="운동 부위"
            items={categories}
            selectedIds={filters.categoryIds}
            isError={categoriesError}
            searchThreshold={SEARCH_THRESHOLD}
            searchPlaceholder="운동 부위 검색"
            onToggle={onToggleCategory}
          />

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
            label="머신"
            items={machineSectionItems}
            selectedIds={filters.templateIds}
            isError={machineTemplatesError}
            searchThreshold={MACHINE_SECTION_SEARCH_THRESHOLD}
            searchPlaceholder="머신 검색"
            onToggle={onToggleTemplate}
          />

          {showAndToggle ? (
            <View className="flex-row items-center justify-between rounded-lg bg-bg-muted px-3 py-3">
              <AppText className="flex-1 text-body-sm text-text-primary">
                선택한 머신 모두 보유한 헬스장만
              </AppText>
              <Switch
                accessibilityLabel="선택한 머신 모두 보유한 헬스장만"
                value={andModeOn}
                onValueChange={handleAndModeToggle}
                trackColor={{ false: colors.bg.subtle, true: colors.accent.DEFAULT }}
                thumbColor={colors.bg.elevated}
              />
            </View>
          ) : null}
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
