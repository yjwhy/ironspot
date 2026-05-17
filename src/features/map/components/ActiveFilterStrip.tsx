import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, ScrollView } from 'react-native';

import { AppText } from '@/shared/components/AppText';
import { colors } from '@/shared/theme/tokens';

import { ACTIVE_FILTER_KIND_LABEL, type ActiveFilter } from '../lib/active-filters';

interface ActiveFilterStripProps {
  filters: readonly ActiveFilter[];
  onRemove: (filter: ActiveFilter) => void;
  testID?: string;
}

export function ActiveFilterStrip({ filters, onRemove, testID }: ActiveFilterStripProps) {
  if (filters.length === 0) return null;

  return (
    <ScrollView
      testID={testID}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
    >
      {filters.map((filter) => (
        <Pressable
          key={`${filter.kind}:${filter.id}`}
          accessibilityRole="button"
          accessibilityLabel={`${ACTIVE_FILTER_KIND_LABEL[filter.kind]} ${filter.label} 필터 제거`}
          onPress={() => {
            onRemove(filter);
          }}
          className="h-8 flex-row items-center gap-1 rounded-full border border-accent bg-accent-50 px-3"
        >
          <AppText className="text-body-sm font-medium text-accent">{filter.label}</AppText>
          <MaterialIcons name="close" size={14} color={colors.accent.DEFAULT} />
        </Pressable>
      ))}
    </ScrollView>
  );
}
