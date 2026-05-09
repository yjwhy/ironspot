import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { colors, radius } from '@/shared/theme/tokens';

interface Props {
  progress: number;
}

const TRACK_HEIGHT = 4;
const ANIMATION_DURATION = 300;

export function UploadProgressBar({ progress }: Props) {
  const scale = useSharedValue(0);

  useEffect(
    function animateProgress() {
      scale.value = withTiming(progress, { duration: ANIMATION_DURATION });
    },
    [progress, scale],
  );

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: scale.value }],
  }));

  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: TRACK_HEIGHT,
    borderRadius: radius.full,
    backgroundColor: colors.border.DEFAULT,
    overflow: 'hidden',
  },
  fill: {
    flex: 1,
    height: TRACK_HEIGHT,
    borderRadius: radius.full,
    backgroundColor: colors.accent.DEFAULT,
    transformOrigin: 'left',
  },
});
