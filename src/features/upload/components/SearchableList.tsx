import { MaterialIcons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { AppText } from '@/shared/components/AppText';
import { pressedOpacity } from '@/shared/lib/pressable';
import { colors } from '@/shared/theme/tokens';

import { selectedRowClass } from './selectedRowClass';

// Phase 5 follow-up C: search-driven radio list used by both step 1 (brand)
// and step 2 (template) of the brand-first manual-input flow. Same visual
// rhythm as MachinePicker's BrandStep / TemplateStep — selectedRowClass is
// shared — but the filtering / matching is owned by the caller, and the
// caller can append a "propose new entry" radio when the query doesn't
// land any existing catalog row.

export interface SearchableRow {
  id: string;
  label: string;
}

export interface ProposeNewRow {
  label: string;
  isSelected: boolean;
  onSelect: () => void;
}

interface SearchableListProps {
  testIDPrefix: string;
  searchPlaceholder: string;
  query: string;
  onChangeQuery: (text: string) => void;
  rows: readonly SearchableRow[];
  selectedRowId: string | null;
  onSelectRow: (rowId: string) => void;
  emptyMessage: string;
  proposeNew: ProposeNewRow | null;
  /**
   * Optional leading element rendered before each row's label. The brand
   * step uses this to drop a `BrandLogo` next to the label; the template
   * step leaves it undefined so rows stay label-only.
   */
  renderLeading?: (row: SearchableRow) => ReactNode;
}

export function SearchableList({
  testIDPrefix,
  searchPlaceholder,
  query,
  onChangeQuery,
  rows,
  selectedRowId,
  onSelectRow,
  emptyMessage,
  proposeNew,
  renderLeading,
}: SearchableListProps) {
  const hasRows = rows.length > 0;
  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-2 rounded-lg bg-bg-muted px-3 py-2">
        <MaterialIcons name="search" size={16} color={colors.text.tertiary} />
        <TextInput
          testID={`${testIDPrefix}-search`}
          value={query}
          onChangeText={onChangeQuery}
          placeholder={searchPlaceholder}
          placeholderTextColor={colors.text.tertiary}
          accessibilityLabel={searchPlaceholder}
          className="flex-1 text-body-sm text-text-primary"
        />
      </View>
      <View className="gap-2">
        {hasRows ? (
          rows.map(function renderRow(row) {
            const isSelected = row.id === selectedRowId;
            return (
              <Pressable
                key={row.id}
                testID={`${testIDPrefix}-option-${row.id}`}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
                onPress={function handlePress() {
                  onSelectRow(row.id);
                }}
                style={pressedOpacity}
                className={selectedRowClass(isSelected)}
              >
                {renderLeading?.(row)}
                <AppText className="text-body text-text-primary">{row.label}</AppText>
              </Pressable>
            );
          })
        ) : (
          <AppText testID={`${testIDPrefix}-empty`} className="text-body-sm text-text-secondary">
            {emptyMessage}
          </AppText>
        )}
        {proposeNew !== null ? (
          <Pressable
            testID={`${testIDPrefix}-propose-new`}
            accessibilityRole="radio"
            accessibilityState={{ checked: proposeNew.isSelected }}
            onPress={proposeNew.onSelect}
            style={pressedOpacity}
            className={selectedRowClass(proposeNew.isSelected)}
          >
            <AppText className="text-body text-text-primary">{proposeNew.label}</AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
