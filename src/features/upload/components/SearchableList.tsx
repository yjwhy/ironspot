import { MaterialIcons } from '@expo/vector-icons';
import { Fragment, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';

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
  /**
   * Optional section a row belongs to (e.g. body part for the template step).
   * When set, SearchableList renders a header before the first row of each
   * group. Rows MUST already be ordered so same-group rows are consecutive —
   * the caller owns the grouping/sort. Rows without `group` render flat (the
   * brand step relies on this).
   */
  group?: string;
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
   * Optional leading element rendered before each row's label, INSIDE the select
   * Pressable — so a tap on it also selects the row. The brand step uses this to
   * drop a `BrandLogo` next to the label; the template step leaves it undefined.
   * (Contrast with `renderTrailing`, which sits outside the select Pressable.)
   */
  renderLeading?: (row: SearchableRow) => ReactNode;
  /**
   * Optional trailing control rendered to the right of each row, OUTSIDE the
   * select Pressable, so tapping it does not select the row. The template step
   * uses this for a "view reference photo" button.
   */
  renderTrailing?: (row: SearchableRow) => ReactNode;
  /**
   * When true, the list area shows a spinner instead of rows / empty message
   * / propose-new. Distinguishes "still fetching" from "fetched, genuinely
   * empty" so the template step doesn't flash `emptyMessage` before its
   * per-brand templates arrive. The search input stays interactive.
   */
  isLoading?: boolean;
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
  renderTrailing,
  isLoading = false,
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
          // The `text-body-sm` typography token sets `lineHeight: 20`, and on
          // iOS RN draws TextInput text/cursor at the TOP of its lineHeight
          // box rather than vertically centering — so the icon + caret floated
          // above the input's visual midline. Mirrors the inline-style fix
          // already in place on FilterSheet's global-search input: drop the
          // lineHeight-bearing class and inline the matching font size.
          style={{ flex: 1, color: colors.text.primary, fontSize: 13 }}
        />
      </View>
      <View className="gap-2">
        {isLoading ? (
          <View testID={`${testIDPrefix}-loading`} className="items-center py-6">
            <ActivityIndicator size="small" color={colors.text.tertiary} />
          </View>
        ) : (
          <Fragment>
            {hasRows ? (
              rows.map(function renderRow(row, index) {
                const isSelected = row.id === selectedRowId;
                // Header to show before this row, or null when the row has no group
                // or shares the previous row's group. Held as a narrowed string so
                // the testID template literal stays string-typed.
                const groupHeader =
                  row.group !== undefined && row.group !== rows[index - 1]?.group
                    ? row.group
                    : null;
                return (
                  <Fragment key={row.id}>
                    {groupHeader !== null ? (
                      <AppText
                        testID={`${testIDPrefix}-group-${groupHeader}`}
                        className="mt-1 text-caption font-semibold uppercase text-text-tertiary"
                      >
                        {groupHeader}
                      </AppText>
                    ) : null}
                    <View className={selectedRowClass(isSelected)}>
                      <Pressable
                        testID={`${testIDPrefix}-option-${row.id}`}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: isSelected }}
                        onPress={function handlePress() {
                          onSelectRow(row.id);
                        }}
                        style={pressedOpacity}
                        className="flex-1 flex-row items-center gap-3"
                      >
                        {renderLeading?.(row)}
                        <AppText className="text-body text-text-primary">{row.label}</AppText>
                      </Pressable>
                      {renderTrailing?.(row)}
                    </View>
                  </Fragment>
                );
              })
            ) : (
              <AppText
                testID={`${testIDPrefix}-empty`}
                className="text-body-sm text-text-secondary"
              >
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
          </Fragment>
        )}
      </View>
    </View>
  );
}
