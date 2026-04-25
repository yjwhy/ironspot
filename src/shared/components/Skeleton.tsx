import { memo, useEffect } from 'react';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { ANIMATION } from '@/shared/theme/tokens';

interface SkeletonRectangleProps {
  variant?: 'rectangle';
  width: number;
  height: number;
}

interface SkeletonCircleProps {
  variant: 'circle';
  size: number;
}

interface SkeletonCommon {
  testID?: string;
}

export type SkeletonProps = (SkeletonRectangleProps | SkeletonCircleProps) & SkeletonCommon;

const SHIMMER_MIN_OPACITY = 0.4;
const SHIMMER_MAX_OPACITY = 1;
const RECTANGLE_RADIUS = 8;

function getDimensions(props: SkeletonProps): {
  width: number;
  height: number;
  borderRadius: number;
} {
  if (props.variant === 'circle') {
    return { width: props.size, height: props.size, borderRadius: props.size / 2 };
  }
  return { width: props.width, height: props.height, borderRadius: RECTANGLE_RADIUS };
}

function SkeletonImpl(props: SkeletonProps) {
  const opacity = useSharedValue(SHIMMER_MAX_OPACITY);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(SHIMMER_MIN_OPACITY, { duration: ANIMATION.shimmerDuration }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(opacity);
    };
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const dimensions = getDimensions(props);

  return (
    <Animated.View
      testID={props.testID}
      accessibilityRole="progressbar"
      accessibilityLabel="로딩 중"
      style={[dimensions, animatedStyle]}
      className="bg-bg-muted"
    />
  );
}

export const Skeleton = memo(SkeletonImpl);
