import { AntDesign } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { AppText } from '@/shared/components/AppText';

export type OAuthProvider = 'google' | 'kakao' | 'apple' | 'naver';

interface OAuthButtonProps {
  provider: OAuthProvider;
  label: string;
  onPress: () => void;
  loading?: boolean;
  /**
   * Disables the press handler (independent of loading). LoginScreen uses
   * this to gate the OAuth flow behind the PIPA consent checkbox (security
   * task #17).
   */
  disabled?: boolean;
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
  // installed icon sets have no dedicated Kakao glyph. null when a text glyph
  // (`iconText`) is used instead — Naver has no icon-set glyph, so its brand
  // "N" is rendered as text.
  iconName: 'google' | 'apple' | 'message' | null;
  iconText?: string;
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
  naver: {
    // Naver brand green (#03C75A) + white "N" glyph, per the 네이버 로그인
    // button style guide. No icon-set glyph exists, so the mark is text.
    containerClass: 'bg-[#03C75A]',
    textClass: 'text-white',
    iconColor: '#FFFFFF',
    spinnerColor: '#FFFFFF',
    iconName: null,
    iconText: 'N',
  },
};

const ICON_SIZE = 18;

export function OAuthButton({
  provider,
  label,
  onPress,
  loading = false,
  disabled = false,
  testID,
}: OAuthButtonProps) {
  const style = PROVIDER_STYLES[provider];
  const inactive = loading || disabled;
  const containerClass = [
    'h-12 px-6 rounded-md flex-row items-center justify-center',
    style.containerClass,
    inactive && 'opacity-50',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      className={containerClass}
    >
      {loading ? (
        <ActivityIndicator color={style.spinnerColor} />
      ) : (
        <View className="flex-row items-center gap-2">
          {style.iconName ? (
            <AntDesign name={style.iconName} size={ICON_SIZE} color={style.iconColor} />
          ) : (
            <AppText className={`font-bold ${style.textClass}`} style={{ fontSize: ICON_SIZE }}>
              {style.iconText}
            </AppText>
          )}
          <AppText className={`font-semibold ${style.textClass}`}>{label}</AppText>
        </View>
      )}
    </Pressable>
  );
}
