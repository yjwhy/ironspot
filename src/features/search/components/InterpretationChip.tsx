import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { AppText } from '@/shared/components/AppText';
import { pressedOpacity } from '@/shared/lib/pressable';
import { colors } from '@/shared/theme/tokens';

interface InterpretationChipProps {
  text: string;
  /**
   * Tone — drives palette, icon, prefix label, and accessibility role.
   * - `success`: amber chip; the AI parsed the query and returned results
   * - `zero`: muted chip; the AI parsed the query but 0 gyms matched
   * - `error`: red chip; the AI rejected the query (non-gym intent etc.) and
   *   surfaces the backend example so the user can recover. Replaces the
   *   prior 3-second toast which truncated the recovery hint.
   */
  tone?: 'success' | 'zero' | 'error';
  onClose: () => void;
}

const TONE_CONFIG = {
  success: {
    label: 'AI 해석',
    icon: 'auto-awesome',
    container: 'bg-accent-50 border-accent-light',
    iconColor: '#D97706', // accent.dark
    dividerColor: '#FCD34D', // accent.light
    accessibilityCloseLabel: '검색 종료',
  },
  zero: {
    label: 'AI 해석',
    icon: 'auto-awesome',
    container: 'bg-bg-muted border-border',
    iconColor: '#94A3B8', // text.tertiary
    dividerColor: '#E2E8F0', // border.DEFAULT
    accessibilityCloseLabel: '검색 종료',
  },
  error: {
    // Distinct label ("안내" not "해석") signals the AI couldn't interpret
    // the query — it isn't reporting WHAT it parsed, it's telling the user
    // why the search was rejected.
    label: 'AI 안내',
    icon: 'info',
    container: 'bg-red-50 border-red-200',
    iconColor: '#DC2626', // red-600
    dividerColor: '#FECACA', // red-200
    accessibilityCloseLabel: '안내 닫기',
  },
} as const;

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
  const config = TONE_CONFIG[tone];
  const containerClass = `${config.container} border rounded-full py-1.5 pl-3 pr-2 flex-row items-center gap-2 self-start max-w-full shadow-sm`;
  return (
    <View className={containerClass} accessibilityRole={tone === 'error' ? 'alert' : undefined}>
      <View className="flex-row items-center gap-1">
        <MaterialIcons name={config.icon} size={14} color={config.iconColor} />
        <AppText className="text-body-sm font-medium text-text-primary">{config.label}</AppText>
      </View>
      <View className="w-px self-stretch" style={{ backgroundColor: config.dividerColor }} />
      <AppText className="text-body-sm text-text-primary flex-1 flex-shrink" numberOfLines={3}>
        {text}
      </AppText>
      <Pressable
        onPress={onClose}
        style={pressedOpacity}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={config.accessibilityCloseLabel}
      >
        <MaterialIcons name="close" size={16} color={colors.text.secondary} />
      </Pressable>
    </View>
  );
}
