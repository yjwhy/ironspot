import { Pressable, Text } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';

import { ANIMATION, TOUCH_CLASSES, colors } from '@/shared/theme/tokens';

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const CONTAINER_CLASS = `${TOUCH_CLASSES.small} rounded-full items-center justify-center`;

export function Chip({ label, selected, onPress, testID }: ChipProps) {
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

  const textClass = selected ? 'text-text-inverse' : 'text-text-secondary';

  return (
    <AnimatedPressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={animatedStyle}
      className={CONTAINER_CLASS}
    >
      <Text className={`font-medium text-body-sm ${textClass}`}>{label}</Text>
    </AnimatedPressable>
  );
}
