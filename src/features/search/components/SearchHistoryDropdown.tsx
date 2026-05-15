import { MaterialIcons } from '@expo/vector-icons';
import * as burnt from 'burnt';
import * as Haptics from 'expo-haptics';
import { Alert, Pressable, View } from 'react-native';

import { AppText } from '@/shared/components/AppText';
import { pressedOpacity } from '@/shared/lib/pressable';
import { colors } from '@/shared/theme/tokens';

import { EXAMPLE_QUERIES } from '../constants';
import type { RecentEntry } from '../lib/recent-storage';

interface SearchHistoryDropdownProps {
  entries: readonly RecentEntry[];
  /** Tap on a row — submits the query immediately. */
  onPick: (query: string) => void;
  /** Tap on the ↖ icon — fills the input but does not submit. */
  onFill: (query: string) => void;
  /** Tap on the × icon — removes the single entry. */
  onRemove: (query: string) => void;
  /** "전체 삭제" — confirmation dialog before invoking. */
  onClearAll: () => void;
}

const NOW_THRESHOLD_MS = 60 * 1000;
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function formatRelative(epochMs: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - epochMs);
  if (diff < NOW_THRESHOLD_MS) return '방금 전';
  if (diff < HOUR_MS) return `${String(Math.floor(diff / MINUTE_MS))}분 전`;
  if (diff < DAY_MS) return `${String(Math.floor(diff / HOUR_MS))}시간 전`;
  return `${String(Math.floor(diff / DAY_MS))}일 전`;
}

export function SearchHistoryDropdown({
  entries,
  onPick,
  onFill,
  onRemove,
  onClearAll,
}: SearchHistoryDropdownProps) {
  if (entries.length === 0) {
    return <EmptyHistory onPick={onPick} />;
  }
  return (
    <View
      testID="search-history-dropdown"
      className="bg-bg-base rounded-md shadow-md border border-border mt-1"
    >
      {entries.map((entry) => (
        <HistoryRow
          key={entry.query}
          entry={entry}
          onPick={onPick}
          onFill={onFill}
          onRemove={onRemove}
        />
      ))}
      <Pressable
        onPress={() => {
          Alert.alert('전체 검색 기록을 삭제할까요?', '복구할 수 없어요.', [
            { text: '취소', style: 'cancel' },
            {
              text: '전체 삭제',
              style: 'destructive',
              onPress: () => {
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                onClearAll();
              },
            },
          ]);
        }}
        style={pressedOpacity}
        accessibilityRole="button"
        accessibilityLabel="검색 기록 전체 삭제"
        className="border-t border-border py-3 items-center"
      >
        <AppText className="text-body-sm text-text-secondary">전체 삭제</AppText>
      </Pressable>
    </View>
  );
}

interface HistoryRowProps {
  entry: RecentEntry;
  onPick: (q: string) => void;
  onFill: (q: string) => void;
  onRemove: (q: string) => void;
}

function HistoryRow({ entry, onPick, onFill, onRemove }: HistoryRowProps) {
  function handleRemove() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onRemove(entry.query);
    burnt.toast({
      title: '검색 기록을 삭제했어요',
      duration: 3,
    });
  }
  return (
    <View className="flex-row items-center px-3 py-3 border-b border-border">
      <MaterialIcons name="history" size={18} color={colors.text.tertiary} />
      <Pressable
        onPress={() => {
          onPick(entry.query);
        }}
        style={pressedOpacity}
        accessibilityRole="button"
        accessibilityLabel={`${entry.query}, ${formatRelative(entry.at)}, 검색하려면 두 번 탭`}
        className="flex-1 ml-2"
      >
        <AppText className="text-body" numberOfLines={1}>
          {entry.query}
        </AppText>
      </Pressable>
      <AppText className="text-body-sm text-text-tertiary mr-2">{formatRelative(entry.at)}</AppText>
      <Pressable
        onPress={() => {
          onFill(entry.query);
        }}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="검색창에 입력"
        className="p-1"
      >
        <MaterialIcons name="north-west" size={18} color={colors.text.tertiary} />
      </Pressable>
      <Pressable
        onPress={handleRemove}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={`${entry.query} 삭제`}
        className="p-1"
      >
        <MaterialIcons name="close" size={18} color={colors.text.tertiary} />
      </Pressable>
    </View>
  );
}

interface EmptyHistoryProps {
  onPick: (q: string) => void;
}

function EmptyHistory({ onPick }: EmptyHistoryProps) {
  return (
    <View
      testID="search-history-empty"
      className="bg-bg-base rounded-md shadow-md border border-border mt-1 p-3 gap-2"
    >
      <AppText className="text-body-sm text-text-secondary px-1">이런 검색을 해보세요</AppText>
      {EXAMPLE_QUERIES.map((q) => (
        <Pressable
          key={q}
          onPress={() => {
            onPick(q);
          }}
          style={pressedOpacity}
          accessibilityRole="button"
          accessibilityLabel={`예시 검색: ${q}`}
          className="flex-row items-center gap-2 p-2 rounded bg-bg-muted"
        >
          <MaterialIcons name="lightbulb-outline" size={18} color={colors.text.tertiary} />
          <AppText className="flex-1 text-body" numberOfLines={1}>
            {q}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}
