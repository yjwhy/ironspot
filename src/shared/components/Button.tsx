import { ActivityIndicator, Pressable, Text } from 'react-native';

import { TOUCH_CLASSES, colors } from '@/shared/theme/tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'md' | 'sm';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  md: 'h-12 px-6',
  sm: TOUCH_CLASSES.small,
};

const VARIANT_BG: Record<ButtonVariant, string> = {
  primary: 'bg-accent',
  secondary: 'bg-bg-muted',
  ghost: 'bg-transparent',
};

const VARIANT_TEXT: Record<ButtonVariant, string> = {
  primary: 'text-text-inverse',
  secondary: 'text-text-primary',
  ghost: 'text-accent',
};

const SPINNER_COLOR: Record<ButtonVariant, string> = {
  primary: colors.text.inverse,
  secondary: colors.text.primary,
  ghost: colors.accent.DEFAULT,
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  testID,
}: ButtonProps) {
  const isInactive = disabled || loading;
  const containerClass = [
    'items-center justify-center rounded-md',
    SIZE_CLASSES[size],
    VARIANT_BG[variant],
    isInactive && 'opacity-50',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Pressable
      onPress={onPress}
      disabled={isInactive}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: isInactive, busy: loading }}
      className={containerClass}
    >
      {loading ? (
        <ActivityIndicator color={SPINNER_COLOR[variant]} />
      ) : (
        <Text className={`font-semibold ${VARIANT_TEXT[variant]}`}>{label}</Text>
      )}
    </Pressable>
  );
}
