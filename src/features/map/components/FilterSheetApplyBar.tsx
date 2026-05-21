import { Pressable, View } from 'react-native';

import { AppText } from '@/shared/components/AppText';
import { pressedOpacity } from '@/shared/lib/pressable';

interface FilterSheetApplyBarProps {
  /**
   * `true` when the staged filters differ from the committed filters
   * (i.e. tapping Apply would change the actual gym query). The bar
   * stays visible even when `false` so the user always has a way back
   * to "no filters" via 전체 초기화, but the Apply CTA dims to signal
   * that no commit is pending.
   */
  hasPendingChanges: boolean;
  onResetAll: () => void;
  onApply: () => void;
}

/**
 * Phase 5 item 23 follow-up: the apply CTA. Staged filter changes only
 * trigger the underlying `useGymSearch` refetch when the user explicitly
 * confirms via this bar — chips/checkboxes inside the sheet were
 * previously firing a network call per toggle which both wasted Render
 * quota and risked transient flicker if the user changed their mind
 * mid-flight.
 */
export function FilterSheetApplyBar({
  hasPendingChanges,
  onResetAll,
  onApply,
}: FilterSheetApplyBarProps) {
  return (
    <View className="flex-row items-center gap-3 border-t border-border bg-bg-elevated px-5 py-3">
      <Pressable
        onPress={onResetAll}
        accessibilityRole="button"
        accessibilityLabel="필터 전체 해제"
        style={pressedOpacity}
        className="h-11 flex-1 items-center justify-center rounded-lg border border-border bg-bg-elevated"
      >
        <AppText className="text-body-md font-medium text-text-secondary">전체 초기화</AppText>
      </Pressable>
      <Pressable
        onPress={onApply}
        accessibilityRole="button"
        accessibilityLabel="필터 적용하기"
        accessibilityState={{ disabled: !hasPendingChanges }}
        style={pressedOpacity}
        className={`h-11 flex-[1.4] items-center justify-center rounded-lg ${
          hasPendingChanges ? 'bg-accent' : 'bg-bg-subtle'
        }`}
      >
        <AppText
          className={`text-body-md font-medium ${
            hasPendingChanges ? 'text-text-inverse' : 'text-text-tertiary'
          }`}
        >
          필터 적용하기
        </AppText>
      </Pressable>
    </View>
  );
}
