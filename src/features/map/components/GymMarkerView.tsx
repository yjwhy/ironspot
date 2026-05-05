import { View } from 'react-native';

import { AppText } from '@/shared/components/AppText';
import { colors } from '@/shared/theme/tokens';

export const MARKER_SIZE_DEFAULT = { width: 32, height: 28 } as const;
export const MARKER_SIZE_SELECTED = { width: 40, height: 34 } as const;

const TRIANGLE_HALF_WIDTH = 6;
export const TRIANGLE_HEIGHT = 6;

interface GymMarkerViewProps {
  machineCount: number;
  isSelected: boolean;
  isMismatch: boolean;
}

function resolveBgColor(isSelected: boolean, isMismatch: boolean): string {
  if (isMismatch) return colors.text.tertiary;
  if (isSelected) return colors.accent.dark;
  return colors.accent.DEFAULT;
}

export function GymMarkerView({ machineCount, isSelected, isMismatch }: GymMarkerViewProps) {
  const size = isSelected ? MARKER_SIZE_SELECTED : MARKER_SIZE_DEFAULT;
  const bgColor = resolveBgColor(isSelected, isMismatch);

  return (
    <View testID="gym-marker-view" collapsable={false} style={{ alignItems: 'center' }}>
      <View
        testID="gym-marker-bubble"
        style={{
          width: size.width,
          height: size.height,
          backgroundColor: bgColor,
          borderRadius: 8,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AppText
          style={{ color: colors.text.inverse, fontSize: 11, fontWeight: '700', lineHeight: 15 }}
        >
          {String(machineCount)}
        </AppText>
      </View>
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: TRIANGLE_HALF_WIDTH,
          borderRightWidth: TRIANGLE_HALF_WIDTH,
          borderTopWidth: TRIANGLE_HEIGHT,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderTopColor: bgColor,
        }}
      />
    </View>
  );
}
