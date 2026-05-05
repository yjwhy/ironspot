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
      <Pressable testID="filter-panel-backdrop" onPress={onClose} className="absolute inset-0" />
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
