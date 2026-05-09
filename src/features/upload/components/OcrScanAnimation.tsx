import { useEffect } from 'react';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '@/shared/theme/tokens';

export function OcrScanAnimation() {
  const translateY = useSharedValue(0);

  useEffect(
    function startScanLoop() {
      translateY.value = withRepeat(
        withTiming(200, { duration: 1500, easing: Easing.linear }),
        -1,
        true,
      );
      return function cleanup() {
        cancelAnimation(translateY);
      };
    },
    // translateY is a stable shared value ref — this effect runs once on mount
    [translateY],
  );

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      style={[style, { height: 2, backgroundColor: colors.accent.DEFAULT, opacity: 0.8 }]}
    />
  );
}
