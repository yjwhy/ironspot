import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { AppText } from '@/shared/components/AppText';
import { type DirectionsGym, type DirectionsSource, openDirections } from '@/shared/lib/directions';
import { pressedOpacity } from '@/shared/lib/pressable';
import { colors } from '@/shared/theme/tokens';

interface DirectionsChipProps {
  gym: DirectionsGym;
  source: DirectionsSource;
}

/**
 * Phase 5 item 16: small inline "길찾기" affordance for the gym card +
 * gym detail screens. Tap fires `openDirections` which routes to Naver
 * Maps via `nmap://` deeplink (or falls back to expo-web-browser if the
 * app is missing). Visually subordinate to the parent card / screen's
 * primary action (Quick Reference §4 `primary-action`).
 */
export function DirectionsChip({ gym, source }: DirectionsChipProps) {
  function handlePress() {
    void openDirections({ gym, source });
  }

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel="길찾기"
      hitSlop={6}
      style={pressedOpacity}
      testID={`directions-chip-${source}`}
    >
      <View className="flex-row items-center gap-1 rounded-full border border-border bg-bg-elevated px-2.5 py-1">
        <MaterialIcons name="directions" size={14} color={colors.accent.DEFAULT} />
        <AppText className="text-caption font-medium text-accent">길찾기</AppText>
      </View>
    </Pressable>
  );
}
