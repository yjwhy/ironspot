import { ScrollView, View } from 'react-native';

import { Chip } from '@/shared/components/Chip';
import type { Brand, Category, SearchFilters } from '@/shared/types/database';

interface FilterBarProps {
  brands: readonly Brand[];
  categories: readonly Category[];
  filters: SearchFilters;
  onBrandChange: (brandId: string | null) => void;
  onCategoryChange: (categoryId: string | null) => void;
}

const CONTENT_STYLE = { paddingHorizontal: 16, gap: 8 };

export function FilterBar({
  brands,
  categories,
  filters,
  onBrandChange,
  onCategoryChange,
}: FilterBarProps) {
  if (brands.length === 0 && categories.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={CONTENT_STYLE}
      className="py-2"
    >
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
      {brands.length > 0 && categories.length > 0 && (
        <View className="w-px bg-border self-stretch my-1" />
      )}
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
    </ScrollView>
  );
}
