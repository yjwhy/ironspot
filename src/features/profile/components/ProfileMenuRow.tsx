import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { AppText } from '@/shared/components/AppText';
import { pressedOpacity } from '@/shared/lib/pressable';
import { colors } from '@/shared/theme/tokens';

type MaterialIconName = keyof typeof MaterialIcons.glyphMap;

const ROW_ICON_SIZE = 24;
const CHEVRON_ICON_SIZE = 20;

interface ProfileMenuRowProps {
  icon: MaterialIconName;
  label: string;
  badge?: string;
  onPress: () => void;
  disabled?: boolean;
  showChevron?: boolean;
  testID?: string;
}

export function ProfileMenuRow({
  icon,
  label,
  badge,
  onPress,
  disabled = false,
  showChevron = true,
  testID,
}: ProfileMenuRowProps) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge}` : label}
      accessibilityState={{ disabled }}
      style={pressedOpacity}
      className="flex-row items-center justify-between px-4 py-4 border-b border-border-DEFAULT"
    >
      <View className="flex-row items-center gap-3">
        <MaterialIcons
          name={icon}
          size={ROW_ICON_SIZE}
          color={colors.text.secondary}
          importantForAccessibility="no"
          accessibilityElementsHidden={true}
        />
        <AppText className="text-body text-text-primary">{label}</AppText>
      </View>
      <View className="flex-row items-center gap-2">
        {badge ? <AppText className="text-body-sm text-text-tertiary">{badge}</AppText> : null}
        {showChevron ? (
          <MaterialIcons
            name="chevron-right"
            size={CHEVRON_ICON_SIZE}
            color={colors.text.tertiary}
            importantForAccessibility="no"
            accessibilityElementsHidden={true}
          />
        ) : null}
      </View>
    </Pressable>
  );
}
