import { MaterialIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';

import { AppText } from '@/shared/components/AppText';
import { Chip } from '@/shared/components/Chip';
import { colors } from '@/shared/theme/tokens';

const DEFAULT_SEARCH_THRESHOLD = 8;
const SECTION_EMPTY_MESSAGE = '필터 항목이 없어요';
const SECTION_ERROR_MESSAGE = '필터를 불러올 수 없어요';
const SECTION_NO_RESULT_MESSAGE = '검색 결과가 없어요';

interface FilterSheetSectionItem {
  id: string;
  name: string;
}

interface FilterSheetSectionProps {
  label: string;
  items: readonly FilterSheetSectionItem[];
  selectedIds: readonly string[];
  isError?: boolean;
  searchThreshold?: number;
  searchPlaceholder?: string;
  onToggle: (id: string) => void;
  testID?: string;
}

export function FilterSheetSection({
  label,
  items,
  selectedIds,
  isError = false,
  searchThreshold = DEFAULT_SEARCH_THRESHOLD,
  searchPlaceholder = '검색',
  onToggle,
  testID,
}: FilterSheetSectionProps) {
  const [query, setQuery] = useState('');
  const searchable = items.length >= searchThreshold;

  const filteredItems = useMemo(() => {
    if (!searchable || query.trim() === '') return items;
    const needle = query.trim().toLowerCase();
    return items.filter((item) => item.name.toLowerCase().includes(needle));
  }, [items, query, searchable]);

  return (
    <View testID={testID} className="gap-2">
      <View className="flex-row items-center justify-between">
        <AppText className="text-body-md font-semibold text-text-primary">{label}</AppText>
        {!isError && items.length > 0 ? (
          <AppText className="text-body-sm text-text-tertiary">
            {`${String(selectedIds.length)} / ${String(items.length)}`}
          </AppText>
        ) : null}
      </View>

      {searchable && !isError ? (
        <View className="flex-row items-center gap-2 rounded-lg bg-bg-muted px-3 py-2">
          <MaterialIcons name="search" size={16} color={colors.text.tertiary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={searchPlaceholder}
            placeholderTextColor={colors.text.tertiary}
            returnKeyType="search"
            accessibilityLabel={searchPlaceholder}
            className="flex-1 text-body-sm text-text-primary"
          />
        </View>
      ) : null}

      <SectionBody
        items={filteredItems}
        totalItems={items}
        selectedIds={selectedIds}
        isError={isError}
        hasQuery={query.trim() !== ''}
        onToggle={onToggle}
      />
    </View>
  );
}

interface SectionBodyProps {
  items: readonly FilterSheetSectionItem[];
  totalItems: readonly FilterSheetSectionItem[];
  selectedIds: readonly string[];
  isError: boolean;
  hasQuery: boolean;
  onToggle: (id: string) => void;
}

function SectionBody({
  items,
  totalItems,
  selectedIds,
  isError,
  hasQuery,
  onToggle,
}: SectionBodyProps) {
  if (isError) {
    return <AppText className="text-body-sm text-text-tertiary">{SECTION_ERROR_MESSAGE}</AppText>;
  }
  if (totalItems.length === 0) {
    return <AppText className="text-body-sm text-text-tertiary">{SECTION_EMPTY_MESSAGE}</AppText>;
  }
  if (items.length === 0 && hasQuery) {
    return (
      <AppText className="text-body-sm text-text-tertiary">{SECTION_NO_RESULT_MESSAGE}</AppText>
    );
  }
  return (
    <View className="flex-row flex-wrap gap-2">
      {items.map((item) => (
        <Chip
          key={item.id}
          label={item.name}
          selected={selectedIds.includes(item.id)}
          onPress={() => {
            onToggle(item.id);
          }}
        />
      ))}
    </View>
  );
}
