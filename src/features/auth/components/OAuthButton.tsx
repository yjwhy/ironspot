import { AntDesign } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { AppText } from '@/shared/components/AppText';

export type OAuthProvider = 'google' | 'kakao' | 'apple';

interface OAuthButtonProps {
  provider: OAuthProvider;
  label: string;
  onPress: () => void;
  loading?: boolean;
  testID?: string;
}

interface ProviderStyle {
  // Tailwind classes that drive the button visuals. Each brand follows its own
  // sign-in style guide (Google: white + outline, Kakao: #FEE500, Apple: black).
  containerClass: string;
  textClass: string;
  iconColor: string;
  spinnerColor: string;
  // AntDesign icon glyph that matches the provider's sign-in branding most
  // closely. Kakao falls back to `message` (speech bubble) because the
  // installed icon sets have no dedicated Kakao glyph.
  iconName: 'google' | 'apple' | 'message';
}

const PROVIDER_STYLES: Record<OAuthProvider, ProviderStyle> = {
  google: {
    containerClass: 'bg-white border border-border',
    textClass: 'text-text-primary',
    iconColor: '#1F1F1F',
    spinnerColor: '#1F1F1F',
    iconName: 'google',
  },
  kakao: {
    containerClass: 'bg-[#FEE500]',
    textClass: 'text-black',
    iconColor: '#000000',
    spinnerColor: '#000000',
    iconName: 'message',
  },
  apple: {
    containerClass: 'bg-black',
    textClass: 'text-white',
    iconColor: '#FFFFFF',
    spinnerColor: '#FFFFFF',
    iconName: 'apple',
  },
};

const ICON_SIZE = 18;

export function OAuthButton({
  provider,
  label,
  onPress,
  loading = false,
  testID,
}: OAuthButtonProps) {
  const style = PROVIDER_STYLES[provider];
  const containerClass = [
    'h-12 px-6 rounded-md flex-row items-center justify-center',
    style.containerClass,
    loading && 'opacity-50',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: loading, busy: loading }}
      className={containerClass}
    >
      {loading ? (
        <ActivityIndicator color={style.spinnerColor} />
      ) : (
        <View className="flex-row items-center gap-2">
          <AntDesign name={style.iconName} size={ICON_SIZE} color={style.iconColor} />
          <AppText className={`font-semibold ${style.textClass}`}>{label}</AppText>
        </View>
      )}
    </Pressable>
  );
}
