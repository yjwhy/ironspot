import { MaterialIcons } from '@expo/vector-icons';
import * as burnt from 'burnt';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/shared/components/AppText';
import { Button } from '@/shared/components/Button';
import { pressedOpacity } from '@/shared/lib/pressable';
import { captureError } from '@/shared/lib/sentry';
import { supabase } from '@/shared/lib/supabase';
import { colors } from '@/shared/theme/tokens';

import { AUTH_REDIRECT_URL, PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from '../constants';
import { parseAuthCallback } from '../lib/parseAuthCallback';

interface LoginScreenProps {
  onBrowseAsGuest: () => void;
  onAuthenticated: () => void;
}

type OAuthProvider = 'google' | 'kakao' | 'apple';
type LoadingProvider = OAuthProvider | null;

export function LoginScreen({ onBrowseAsGuest, onAuthenticated }: LoginScreenProps) {
  const [loading, setLoading] = useState<LoadingProvider>(null);

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
        <PolicyDisclosure />

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
        {Platform.OS === 'ios' ? (
          <Button
            label="Apple로 계속하기"
            onPress={() => {
              void handleOAuthLogin('apple');
            }}
            loading={loading === 'apple'}
            variant="secondary"
          />
        ) : null}
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

function openPrivacyPolicy() {
  void WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL);
}

function openTermsOfService() {
  void WebBrowser.openBrowserAsync(TERMS_OF_SERVICE_URL);
}

function PolicyDisclosure() {
  return (
    <View className="items-center px-2 pb-1">
      <AppText className="text-body-sm text-text-tertiary text-center">
        회원가입 시{' '}
        <AppText
          className="underline text-text-secondary"
          onPress={openPrivacyPolicy}
          accessibilityRole="link"
          accessibilityLabel="개인정보처리방침 열기"
        >
          개인정보처리방침
        </AppText>
        과{' '}
        <AppText
          className="underline text-text-secondary"
          onPress={openTermsOfService}
          accessibilityRole="link"
          accessibilityLabel="이용약관 열기"
        >
          이용약관
        </AppText>
        에 동의합니다
      </AppText>
    </View>
  );
}
