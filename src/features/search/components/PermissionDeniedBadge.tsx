import { MaterialIcons } from '@expo/vector-icons';
import { Linking, Pressable } from 'react-native';

import { AppText } from '@/shared/components/AppText';
import { pressedOpacity } from '@/shared/lib/pressable';
import { colors } from '@/shared/theme/tokens';

interface PermissionDeniedBadgeProps {
  /** Tap behaviour — defaults to opening the OS settings page. */
  onPress?: () => void;
}

export function PermissionDeniedBadge({ onPress }: PermissionDeniedBadgeProps) {
  function handlePress() {
    if (onPress) {
      onPress();
      return;
    }
    void Linking.openSettings();
  }

  return (
    <Pressable
      onPress={handlePress}
      style={pressedOpacity}
      accessibilityRole="button"
      accessibilityLabel="위치 권한 거부됨, 강남역 기준으로 표시 중. 두 번 탭하여 설정 열기."
      className="bg-bg-muted border border-border rounded-md px-3 py-2 flex-row items-center gap-2"
    >
      <MaterialIcons name="location-off" size={16} color={colors.text.secondary} />
      <AppText className="flex-1 text-body-sm text-text-secondary">
        위치 권한 거부됨 — 강남역 기준
      </AppText>
      <MaterialIcons name="chevron-right" size={16} color={colors.text.tertiary} />
    </Pressable>
  );
}
