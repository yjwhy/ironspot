import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { colors } from '@/shared/theme/tokens';

import { MicButton } from './MicButton';
import { SearchHistoryDropdown } from './SearchHistoryDropdown';
import { useRecentSearches } from '../hooks/useRecentSearches';

interface TopSearchBarProps {
  /** Submit handler — fires when the user presses Enter or taps a history row. */
  onSubmit: (query: string) => void;
  /** Whether a search is in flight — disables submit + dims the bar. */
  isPending?: boolean;
}

export function TopSearchBar({ onSubmit, isPending = false }: TopSearchBarProps) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const recent = useRecentSearches();

  function submit(value: string) {
    const trimmed = value.trim();
    if (trimmed === '' || isPending) return;
    setQuery(trimmed);
    setFocused(false);
    onSubmit(trimmed);
  }

  function fillOnly(value: string) {
    setQuery(value);
  }

  return (
    <View>
      <View className="flex-row items-center gap-2 bg-bg-muted rounded-md px-3">
        <MaterialIcons name="search" size={20} color={colors.text.tertiary} />
        <TextInput
          testID="top-search-input"
          placeholder="예: 강남역 1km 안 파나타 머신 3개"
          placeholderTextColor={colors.text.tertiary}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => {
            submit(query);
          }}
          onFocus={() => {
            setFocused(true);
          }}
          onBlur={() => {
            setFocused(false);
          }}
          returnKeyType="search"
          editable={!isPending}
          accessibilityLabel="자연어 검색"
          className="flex-1 py-3 text-body text-text-primary"
        />
        {query !== '' ? (
          <Pressable
            onPress={() => {
              setQuery('');
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="입력 지우기"
          >
            <MaterialIcons name="close" size={18} color={colors.text.tertiary} />
          </Pressable>
        ) : null}
        <MicButton onTranscript={setQuery} />
      </View>
      {focused ? (
        <SearchHistoryDropdown
          entries={recent.entries}
          onPick={(q) => {
            submit(q);
          }}
          onFill={fillOnly}
          onRemove={recent.remove}
          onClearAll={recent.clear}
        />
      ) : null}
    </View>
  );
}
