import { memo } from 'react';
import { Pressable, Text } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';

import { ANIMATION, colors } from '@/shared/theme/tokens';

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function ChipImpl({ label, selected, onPress, testID }: ChipProps) {
  const progress = useDerivedValue(() =>
    withTiming(selected ? 1 : 0, { duration: ANIMATION.microDuration }),
  );

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [colors.bg.muted, colors.accent.DEFAULT],
    ),
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={animatedStyle}
      className="h-9 px-4 rounded-full items-center justify-center"
    >
      <Text
        className={`font-medium text-body-sm ${
          selected ? 'text-text-inverse' : 'text-text-secondary'
        }`}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
}

export const Chip = memo(ChipImpl);
