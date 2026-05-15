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
  const containerClass =
    tone === 'zero'
      ? 'bg-bg-muted border border-border rounded-full px-3 py-1.5 flex-row items-center gap-2 self-start'
      : 'bg-accent-50 border border-accent-light rounded-full px-3 py-1.5 flex-row items-center gap-2 self-start';
  const iconColor = tone === 'zero' ? colors.text.tertiary : colors.accent.dark;
  return (
    <View className="gap-1 self-start">
      <AppText className="text-body-sm text-text-tertiary px-1">이렇게 해석했어요</AppText>
      <View className={containerClass}>
        <MaterialIcons name="auto-awesome" size={14} color={iconColor} />
        <AppText className="text-body-sm text-text-primary" numberOfLines={1}>
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
    </View>
  );
}
