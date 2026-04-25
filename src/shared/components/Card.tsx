import { memo } from 'react';
import type { ReactNode } from 'react';
import type { PressableStateCallbackType } from 'react-native';
import { Pressable, View } from 'react-native';

export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  padding?: CardPadding;
  testID?: string;
}

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

function CardImpl({ children, onPress, padding = 'lg', testID }: CardProps) {
  const className = buildClassName(padding);

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        testID={testID}
        accessibilityRole="button"
        style={pressedOpacity}
        className={className}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View testID={testID} className={className}>
      {children}
    </View>
  );
}

export const Card = memo(CardImpl);
