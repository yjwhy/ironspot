import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useAuthedImageSource } from '@/shared/hooks/useAuthedImageSource';

const DOUBLE_TAP_SCALE = 2;
const MIN_SCALE = 1;
const ZOOM_DURATION = 200;

interface ZoomableImageProps {
  /** Security A3: relative proxy path; loaded via the authenticated proxy. */
  contentPath: string | null | undefined;
  width: number;
  height: number;
  accessibilityLabel?: string;
}

export function ZoomableImage({
  contentPath,
  width,
  height,
  accessibilityLabel,
}: ZoomableImageProps) {
  const source = useAuthedImageSource(contentPath);
  const scale = useSharedValue(MIN_SCALE);
  const savedScale = useSharedValue(MIN_SCALE);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      'worklet';
      scale.value = savedScale.value * event.scale;
    })
    .onEnd(() => {
      'worklet';
      if (scale.value < MIN_SCALE) {
        resetTransform(scale, savedScale, translateX, translateY, savedTranslateX, savedTranslateY);
      } else {
        savedScale.value = scale.value;
      }
    });

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      'worklet';
      if (scale.value > MIN_SCALE) {
        translateX.value = savedTranslateX.value + event.translationX;
        translateY.value = savedTranslateY.value + event.translationY;
      }
    })
    .onEnd(() => {
      'worklet';
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      'worklet';
      if (scale.value > MIN_SCALE) {
        scale.value = withTiming(MIN_SCALE, { duration: ZOOM_DURATION });
        savedScale.value = MIN_SCALE;
        translateX.value = withTiming(0, { duration: ZOOM_DURATION });
        translateY.value = withTiming(0, { duration: ZOOM_DURATION });
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        scale.value = withTiming(DOUBLE_TAP_SCALE, { duration: ZOOM_DURATION });
        savedScale.value = DOUBLE_TAP_SCALE;
      }
    });

  // Phase 1: pager swipe is NOT blocked while zoomed. Instagram-style lock
  // (disable horizontal pager when scale > 1) is deferred to Task 14 polish.
  const composed = Gesture.Exclusive(doubleTap, Gesture.Simultaneous(pinch, pan));

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        accessible
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
        style={[{ width, height }, animatedStyle]}
      >
        <Image source={source} style={{ width, height }} contentFit="contain" />
      </Animated.View>
    </GestureDetector>
  );
}

interface SharedNumber {
  value: number;
}

function resetTransform(
  scale: SharedNumber,
  savedScale: SharedNumber,
  translateX: SharedNumber,
  translateY: SharedNumber,
  savedTranslateX: SharedNumber,
  savedTranslateY: SharedNumber,
): void {
  'worklet';
  scale.value = withTiming(MIN_SCALE, { duration: ZOOM_DURATION });
  savedScale.value = MIN_SCALE;
  translateX.value = withTiming(0, { duration: ZOOM_DURATION });
  translateY.value = withTiming(0, { duration: ZOOM_DURATION });
  savedTranslateX.value = 0;
  savedTranslateY.value = 0;
}
