import type { ReactNode } from 'react';
import type { PressableStateCallbackType } from 'react-native';
import { Pressable, View } from 'react-native';

export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  padding?: CardPadding;
  testID?: string;
  accessibilityLabel?: string;
}

// Mirrors `tokens.spacing` (sm=8, md=12, lg=16). Tailwind's default scale
// happens to match (`p-2`=8, `p-3`=12, `p-4`=16). If `tailwind.config.js`
// ever overrides `spacing`, update this map in lockstep.
const PADDING_CLASSES: Record<CardPadding, string> = {
  none: '',
  sm: 'p-2',
  md: 'p-3',
  lg: 'p-4',
};

const BASE_CLASS = 'bg-bg-elevated rounded-lg shadow-md';

function buildClassName(padding: CardPadding): string {
  return [BASE_CLASS, PADDING_CLASSES[padding]].filter(Boolean).join(' ');
}

function pressedOpacity({ pressed }: PressableStateCallbackType) {
  return { opacity: pressed ? 0.8 : 1 };
}

export function Card({ children, onPress, padding = 'lg', testID, accessibilityLabel }: CardProps) {
  const className = buildClassName(padding);

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={pressedOpacity}
        className={className}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View
      testID={testID}
      accessibilityRole="none"
      accessibilityLabel={accessibilityLabel}
      className={className}
    >
      {children}
    </View>
  );
}
