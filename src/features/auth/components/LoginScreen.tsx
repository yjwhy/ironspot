import { MaterialIcons } from '@expo/vector-icons';
import * as burnt from 'burnt';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/shared/components/AppText';
import { Button } from '@/shared/components/Button';
import { pressedOpacity } from '@/shared/lib/pressable';
import { captureError } from '@/shared/lib/sentry';
import { supabase } from '@/shared/lib/supabase';
import { colors } from '@/shared/theme/tokens';

import { AUTH_REDIRECT_URL } from '../constants';
import { parseAuthCallback } from '../lib/parseAuthCallback';

interface LoginScreenProps {
  onBrowseAsGuest: () => void;
  onAuthenticated: () => void;
}

type OAuthProvider = 'google' | 'kakao' | 'apple';
type LoadingProvider = OAuthProvider | null;

const APPLE_CANCEL_CODE = 'ERR_REQUEST_CANCELED';
const NONCE_BYTE_LENGTH = 16;

export function LoginScreen({ onBrowseAsGuest, onAuthenticated }: LoginScreenProps) {
  const [loading, setLoading] = useState<LoadingProvider>(null);
  const [appleNativeAvailable, setAppleNativeAvailable] = useState(false);

  useEffect(function detectAppleNativeAvailability() {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync()
      .then(setAppleNativeAvailable)
      .catch(function ignoreUnavailable() {
        setAppleNativeAvailable(false);
      });
  }, []);

  /**
   * Drives the OAuth flow end-to-end: signInWithOAuth → WebBrowser → callback parse
   * → exchangeCodeForSession (PKCE) or setSession (implicit) → onAuthenticated().
   *
   * User-cancelled WebBrowser sessions (`result.type !== 'success'`) return silently —
   * no toast, no Sentry, no onAuthenticated. Every other failure goes through `catch`
   * which reports to Sentry and shows the same user-facing toast.
   */
  async function handleOAuthLogin(provider: OAuthProvider) {
    setLoading(provider);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: AUTH_REDIRECT_URL, skipBrowserRedirect: true },
      });
      if (error) throw error;
      if (!data.url) throw new Error('Missing OAuth URL');

      const result = await WebBrowser.openAuthSessionAsync(data.url, AUTH_REDIRECT_URL);
      if (result.type !== 'success' || !result.url) return;

      const parsed = parseAuthCallback(result.url);
      switch (parsed.kind) {
        case 'pkce': {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(parsed.code);
          if (exchangeError) throw exchangeError;
          break;
        }
        case 'implicit': {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: parsed.accessToken,
            refresh_token: parsed.refreshToken,
          });
          if (sessionError) throw sessionError;
          break;
        }
        case 'invalid':
          throw new Error(`OAuth callback invalid: ${parsed.reason}`);
      }

      onAuthenticated();
    } catch (err) {
      captureError(err);
      burnt.toast({ title: '로그인에 실패했습니다', preset: 'error' });
    } finally {
      setLoading(null);
    }
  }

  /**
   * Native iOS Apple Sign In (Task 48 / ADR 0024). Uses expo-apple-authentication's
   * in-process system sheet instead of the WebBrowser redirect — required by Apple
   * HIG 4.8 and gives Face ID / Touch ID prompts. Falls back to {@link handleOAuthLogin}
   * web flow on simulators / pre-iOS-13 devices where isAvailableAsync returns false.
   *
   * Nonce: a 16-byte random raw nonce is hashed (SHA-256) and sent to Apple; the raw
   * value goes to Supabase. Supabase verifies the hash matches what Apple signed.
   * Reusing raw on both sides would let a relay attacker swap identityTokens.
   */
  async function handleAppleNativeLogin() {
    setLoading('apple');
    try {
      const rawBytes = await Crypto.getRandomBytesAsync(NONCE_BYTE_LENGTH);
      const rawNonce = Array.from(rawBytes)
        .map(function toHex(byte) {
          return byte.toString(16).padStart(2, '0');
        })
        .join('');
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce,
      );

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (!credential.identityToken) {
        throw new Error('Apple credential missing identityToken');
      }

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        nonce: rawNonce,
      });
      if (error) throw error;

      // Apple only returns fullName on first sign-in. Persist to user_metadata so
      // ProfileScreen has it even after the second login when Apple sends nothing.
      const givenName = credential.fullName?.givenName;
      const familyName = credential.fullName?.familyName;
      const fullName = [givenName, familyName].filter(Boolean).join(' ').trim();
      if (fullName.length > 0) {
        await supabase.auth.updateUser({ data: { full_name: fullName } });
      }

      onAuthenticated();
    } catch (err) {
      const isCancel =
        err instanceof Error &&
        'code' in err &&
        (err as { code?: string }).code === APPLE_CANCEL_CODE;
      if (isCancel) return; // user closed the sheet — same UX as Google/Kakao cancel
      captureError(err);
      burnt.toast({ title: '로그인에 실패했습니다', preset: 'error' });
    } finally {
      setLoading(null);
    }
  }

  const showAppleButton = Platform.OS === 'ios';

  return (
    <SafeAreaView className="flex-1 bg-bg-base justify-between px-6 py-12">
      <View className="flex-1 items-center justify-center gap-4">
        <MaterialIcons name="fitness-center" size={48} color={colors.accent.DEFAULT} />
        <AppText className="text-display font-bold text-text-primary">IronSpot</AppText>
        <AppText className="text-body text-text-secondary text-center">
          내 주변 헬스장 기구를 찾아보세요
        </AppText>
      </View>

      <View className="gap-3">
        <Button
          label="Google로 계속하기"
          onPress={() => {
            void handleOAuthLogin('google');
          }}
          loading={loading === 'google'}
          variant="primary"
        />
        <Button
          label="Kakao로 계속하기"
          onPress={() => {
            void handleOAuthLogin('kakao');
          }}
          loading={loading === 'kakao'}
          variant="secondary"
        />
        {showAppleButton ? (
          <Button
            label="Apple로 계속하기"
            onPress={() => {
              if (appleNativeAvailable) {
                void handleAppleNativeLogin();
              } else {
                void handleOAuthLogin('apple');
              }
            }}
            loading={loading === 'apple'}
            variant="secondary"
            testID="apple-sign-in-button"
          />
        ) : null}
        <AppText className="text-caption text-text-tertiary text-center mt-2">
          계속하기로 진행하면 개인정보처리방침과 이용약관에 동의하게 돼요.
        </AppText>
        <Pressable
          onPress={onBrowseAsGuest}
          accessibilityRole="button"
          accessibilityLabel="로그인 없이 둘러보기"
          className="items-center py-3"
          style={pressedOpacity}
        >
          <AppText className="text-body-sm text-text-tertiary">로그인 없이 둘러보기 →</AppText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
