import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useReduceMotion } from '@/shared/hooks/useReduceMotion';
import { ANIMATION, colors, radius } from '@/shared/theme/tokens';

import { AppText } from './AppText';

const INDICATOR_INSET = 4;

interface SegmentedControlSegment<T extends string | null> {
  label: string;
  value: T;
}

interface SegmentedControlProps<T extends string | null> {
  segments: readonly SegmentedControlSegment<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
  testID?: string;
}

export function SegmentedControl<T extends string | null>({
  segments,
  value,
  onChange,
  accessibilityLabel,
  testID,
}: SegmentedControlProps<T>) {
  const activeIndex = segments.findIndex((segment) => segment.value === value);
  const [containerWidth, setContainerWidth] = useState(0);
  const segmentWidth =
    segments.length > 0 && containerWidth > 0
      ? (containerWidth - INDICATOR_INSET * 2) / segments.length
      : 0;

  const reduceMotion = useReduceMotion();
  const translateX = useSharedValue(0);

  useEffect(
    function syncIndicatorPosition() {
      if (segmentWidth === 0 || activeIndex < 0) return;
      const target = activeIndex * segmentWidth;
      translateX.value = reduceMotion
        ? target
        : withTiming(target, { duration: ANIMATION.microDuration });
    },
    [activeIndex, segmentWidth, reduceMotion, translateX],
  );

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    width: segmentWidth,
  }));

  return (
    <View
      testID={testID}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      onLayout={(event) => {
        setContainerWidth(event.nativeEvent.layout.width);
      }}
      className="relative flex-row rounded-full bg-bg-muted"
      style={{ padding: INDICATOR_INSET }}
    >
      {segmentWidth > 0 && activeIndex >= 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: INDICATOR_INSET,
              bottom: INDICATOR_INSET,
              left: INDICATOR_INSET,
              borderRadius: radius.full,
              backgroundColor: colors.bg.elevated,
            },
            indicatorStyle,
          ]}
        />
      )}
      {segments.map((segment) => {
        const selected = segment.value === value;
        const textClass = selected ? 'text-text-primary' : 'text-text-secondary';
        return (
          <Pressable
            key={segment.label}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              if (!selected) onChange(segment.value);
            }}
            className="flex-1 items-center justify-center py-2"
          >
            <AppText className={`text-body-sm font-medium ${textClass}`}>{segment.label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
