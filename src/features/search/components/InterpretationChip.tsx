import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { AppText } from '@/shared/components/AppText';
import { pressedOpacity } from '@/shared/lib/pressable';
import { colors } from '@/shared/theme/tokens';

interface InterpretationChipProps {
  text: string;
  onClose: () => void;
}

export function InterpretationChip({ text, onClose }: InterpretationChipProps) {
  return (
    <View className="bg-accent-50 border border-accent-light rounded-full px-3 py-1.5 flex-row items-center gap-2 self-start">
      <MaterialIcons name="auto-awesome" size={14} color={colors.accent.dark} />
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
  );
}
