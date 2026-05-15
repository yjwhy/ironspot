import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { AppText } from '@/shared/components/AppText';
import { pressedOpacity } from '@/shared/lib/pressable';
import { colors } from '@/shared/theme/tokens';

interface InterpretationChipProps {
  text: string;
  /** Tone — `zero` switches to a muted warning palette for 0-result NL searches. */
  tone?: 'success' | 'zero';
  onClose: () => void;
}

export function InterpretationChip({ text, tone = 'success', onClose }: InterpretationChipProps) {
  // Inline-prefix layout: the "AI 해석" label lives INSIDE the chip on the
  // left, separated from the interpretation body by a vertical divider, with
  // the close button on the right. This replaces an earlier "floating label
  // above the chip" design that had no background of its own — the floating
  // label ran into a contrast problem against the variable map base (white
  // streets, beige blocks, grey roads).
  //
  // Body wraps to two lines via `flex-shrink` + `numberOfLines={2}` when the
  // interpretation is too long for one line; the prefix stays vertically
  // centered relative to the wrapped body and the divider stretches.
  // `rounded-full` + `shadow-sm` differentiate this informational chip from
  // the input control above (TopSearchBar uses `rounded-md` and no shadow).
  // The pill shape signals "tag/annotation"; the elevation pulls the chip
  // off the same plane as the search bar so the two read as distinct roles.
  // Matches the existing on-map floating pattern (FilterButton, SearchAreaButton).
  const containerClass =
    tone === 'zero'
      ? 'bg-bg-muted border border-border rounded-full py-1.5 pl-3 pr-2 flex-row items-center gap-2 self-start max-w-full shadow-sm'
      : 'bg-accent-50 border border-accent-light rounded-full py-1.5 pl-3 pr-2 flex-row items-center gap-2 self-start max-w-full shadow-sm';
  const sparkleColor = tone === 'zero' ? colors.text.tertiary : colors.accent.dark;
  const dividerColor = tone === 'zero' ? colors.border.DEFAULT : colors.accent.light;
  return (
    <View className={containerClass}>
      <View className="flex-row items-center gap-1">
        <MaterialIcons name="auto-awesome" size={14} color={sparkleColor} />
        <AppText className="text-body-sm font-medium text-text-primary">AI 해석</AppText>
      </View>
      <View className="w-px self-stretch" style={{ backgroundColor: dividerColor }} />
      <AppText className="text-body-sm text-text-primary flex-1 flex-shrink" numberOfLines={2}>
        {text}
      </AppText>
      <Pressable
        onPress={onClose}
        style={pressedOpacity}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="검색 종료"
      >
        <MaterialIcons name="close" size={16} color={colors.text.secondary} />
      </Pressable>
    </View>
  );
}
