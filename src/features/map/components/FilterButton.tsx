import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { AppText } from '@/shared/components/AppText';
import { pressedOpacity } from '@/shared/lib/pressable';
import { colors } from '@/shared/theme/tokens';

interface FilterButtonProps {
  activeCount: number;
  onPress: () => void;
}

export function FilterButton({ activeCount, onPress }: FilterButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="필터"
      style={pressedOpacity}
      className="relative items-center justify-center w-10 h-10 rounded-full bg-bg-elevated shadow-sm"
    >
      <MaterialIcons name="tune" size={20} color={colors.text.primary} />
      {activeCount > 0 && (
        <View
          testID="filter-badge"
          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-accent items-center justify-center"
        >
          <AppText className="text-text-inverse font-bold" style={{ fontSize: 10 }}>
            {String(activeCount)}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}
