import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { AppText } from '@/shared/components/AppText';
import { Chip } from '@/shared/components/Chip';
import { ANIMATION } from '@/shared/theme/tokens';
import type { Brand, Category } from '@/shared/types/database';

const PANEL_SLIDE_OFFSET = 8;
// Exit is 65% of enter duration — feels responsive (ui-design.md animation principles)
const EXIT_DURATION = Math.round(ANIMATION.microDuration * 0.65);

const SECTION_EMPTY_MESSAGE = '필터 항목이 없어요';
const SECTION_ERROR_MESSAGE = '필터를 불러올 수 없어요';

interface FilterSectionItem {
  id: string;
  name: string;
}

interface FilterSectionProps {
  label: string;
  items: readonly FilterSectionItem[];
  selectedId: string | null;
  isError: boolean;
  onToggle: (id: string | null) => void;
}

function FilterSection({ label, items, selectedId, isError, onToggle }: FilterSectionProps) {
  return (
    <View className="gap-2">
      <AppText className="font-semibold text-body-sm text-text-secondary">{label}</AppText>
      <FilterSectionBody
        items={items}
        selectedId={selectedId}
        isError={isError}
        onToggle={onToggle}
      />
    </View>
  );
}

function FilterSectionBody({
  items,
  selectedId,
  isError,
  onToggle,
}: Omit<FilterSectionProps, 'label'>) {
  // Precedence: error > empty > items. An errored query whose data defaults to []
  // would otherwise render the empty message even though the real cause is a fetch failure.
  if (isError) {
    return <AppText className="text-body-sm text-text-tertiary">{SECTION_ERROR_MESSAGE}</AppText>;
  }
  if (items.length === 0) {
    return <AppText className="text-body-sm text-text-tertiary">{SECTION_EMPTY_MESSAGE}</AppText>;
  }
  return (
    <View className="flex-row flex-wrap gap-2">
      {items.map((item) => (
        <Chip
          key={item.id}
          label={item.name}
          selected={selectedId === item.id}
          onPress={() => {
            onToggle(selectedId === item.id ? null : item.id);
          }}
        />
      ))}
    </View>
  );
}

interface FilterPanelProps {
  visible: boolean;
  brands: readonly Brand[];
  categories: readonly Category[];
  brandsError: boolean;
  categoriesError: boolean;
  selectedBrandId: string | null;
  selectedCategoryId: string | null;
  onBrandToggle: (brandId: string | null) => void;
  onCategoryToggle: (categoryId: string | null) => void;
  onClose: () => void;
}

export function FilterPanel({
  visible,
  brands,
  categories,
  brandsError,
  categoriesError,
  selectedBrandId,
  selectedCategoryId,
  onBrandToggle,
  onCategoryToggle,
  onClose,
}: FilterPanelProps) {
  const [rendered, setRendered] = useState(visible);
  const progress = useSharedValue(visible ? 1 : 0);

  useEffect(
    function syncVisibilityAndAnimation() {
      if (visible) {
        setRendered(true);
        progress.value = withTiming(1, { duration: ANIMATION.microDuration });
        return;
      }
      progress.value = withTiming(0, { duration: EXIT_DURATION });
      const timer = setTimeout(() => {
        setRendered(false);
      }, EXIT_DURATION);
      return () => {
        clearTimeout(timer);
      };
    },
    [visible, progress],
  );

  const panelStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * -PANEL_SLIDE_OFFSET }],
  }));

  if (!rendered) return null;

  return (
    <>
      <Pressable testID="filter-panel-backdrop" onPress={onClose} className="absolute inset-0" />
      <Animated.View
        style={panelStyle}
        className="mx-4 mt-2 rounded-2xl bg-bg-elevated shadow-md p-4 gap-4"
      >
        <FilterSection
          label="브랜드"
          items={brands}
          selectedId={selectedBrandId}
          isError={brandsError}
          onToggle={onBrandToggle}
        />
        <FilterSection
          label="머신 종류"
          items={categories}
          selectedId={selectedCategoryId}
          isError={categoriesError}
          onToggle={onCategoryToggle}
        />
      </Animated.View>
    </>
  );
}
