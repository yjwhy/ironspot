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

interface FilterPanelProps {
  visible: boolean;
  brands: readonly Brand[];
  categories: readonly Category[];
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
  selectedBrandId,
  selectedCategoryId,
  onBrandToggle,
  onCategoryToggle,
  onClose,
}: FilterPanelProps) {
  const [rendered, setRendered] = useState(visible);
  const progress = useSharedValue(visible ? 1 : 0);

  useEffect(
    function syncAnimation() {
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
        {brands.length > 0 && (
          <View className="gap-2">
            <AppText className="font-semibold text-body-sm text-text-secondary">브랜드</AppText>
            <View className="flex-row flex-wrap gap-2">
              {brands.map((brand) => (
                <Chip
                  key={brand.id}
                  label={brand.name}
                  selected={selectedBrandId === brand.id}
                  onPress={() => {
                    onBrandToggle(selectedBrandId === brand.id ? null : brand.id);
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
                  selected={selectedCategoryId === category.id}
                  onPress={() => {
                    onCategoryToggle(selectedCategoryId === category.id ? null : category.id);
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
