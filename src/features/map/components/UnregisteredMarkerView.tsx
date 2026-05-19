import { View } from 'react-native';

import { AppText } from '@/shared/components/AppText';
import { colors } from '@/shared/theme/tokens';

export const UNREGISTERED_MARKER_SIZE = { width: 28, height: 28 } as const;

const TRIANGLE_HALF_WIDTH = 5;
const TRIANGLE_HEIGHT = 5;
const BORDER_WIDTH = 1.5;

export function getUnregisteredOverlaySize(): { width: number; height: number } {
  return {
    width: UNREGISTERED_MARKER_SIZE.width,
    height: UNREGISTERED_MARKER_SIZE.height + TRIANGLE_HEIGHT,
  };
}

export function UnregisteredMarkerView() {
  return (
    <View testID="unregistered-marker-view" collapsable={false} style={{ alignItems: 'center' }}>
      <View
        testID="unregistered-marker-bubble"
        style={{
          width: UNREGISTERED_MARKER_SIZE.width,
          height: UNREGISTERED_MARKER_SIZE.height,
          backgroundColor: colors.bg.base,
          borderRadius: 14,
          borderWidth: BORDER_WIDTH,
          borderColor: colors.text.tertiary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AppText
          style={{
            color: colors.text.tertiary,
            fontSize: 16,
            fontWeight: '600',
            lineHeight: 18,
          }}
        >
          +
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
          borderTopColor: colors.text.tertiary,
        }}
      />
    </View>
  );
}
