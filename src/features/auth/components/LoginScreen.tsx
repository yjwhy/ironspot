import { MaterialIcons } from '@expo/vector-icons';
import * as burnt from 'burnt';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/shared/components/AppText';
import { useRecordConsent } from '@/shared/generated/users/users';
import { pressedOpacity } from '@/shared/lib/pressable';
import { captureError } from '@/shared/lib/sentry';
import { supabase } from '@/shared/lib/supabase';
import { colors } from '@/shared/theme/tokens';

import { OAuthButton } from './OAuthButton';
import {
  AUTH_REDIRECT_URL,
  CONSENT_VERSION,
  PRIVACY_POLICY_URL,
  TERMS_OF_SERVICE_URL,
} from '../constants';
import { parseAuthCallback } from '../lib/parseAuthCallback';

interface LoginScreenProps {
  onBrowseAsGuest: () => void;
  onAuthenticated: () => void;
}

type OAuthProvider = 'google' | 'kakao' | 'apple';
type LoadingProvider = OAuthProvider | null;

export function LoginScreen({ onBrowseAsGuest, onAuthenticated }: LoginScreenProps) {
  const [loading, setLoading] = useState<LoadingProvider>(null);
  // Security task #17: active PIPA consent gate. Both checkboxes must be
  // ticked before any OAuth button is enabled — disclosure-only text is
  // not sufficient under PIPA Article 22 for the audit trail.
  const [consentAccepted, setConsentAccepted] = useState(false);
  const { mutateAsync: recordConsent } = useRecordConsent();

  /**
   * Drives the OAuth flow end-to-end: signInWithOAuth → WebBrowser → callback parse
   * → exchangeCodeForSession (PKCE only) → onAuthenticated(). Implicit-flow
   * callbacks are rejected at the parser (security #16) so an intercepted
   * custom-scheme callback cannot setSession with whatever the URL handed us.
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
        case 'invalid':
          // Security task #16: implicit_flow_rejected lands here too. The
          // implicit branch is gone; any hash-fragment callback is treated
          // as a potential custom-scheme hijack and rejected.
          throw new Error(`OAuth callback invalid: ${parsed.reason}`);
      }

      // Security task #17: record the active-consent the user gave at the
      // gate. Best-effort — a record failure (network, BE down) does not
      // block onAuthenticated() because the gate has already enforced the
      // consent client-side. The next /me fetch will re-attempt on the
      // FE side via the consent-version reconciliation hook (future).
      try {
        await recordConsent({ data: { version: CONSENT_VERSION } });
      } catch (consentErr) {
        captureError(consentErr);
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
        <ConsentCheckbox checked={consentAccepted} onToggle={setConsentAccepted} />

        <OAuthButton
          provider="google"
          label="Google로 계속하기"
          onPress={() => {
            void handleOAuthLogin('google');
          }}
          loading={loading === 'google'}
          disabled={!consentAccepted}
        />
        <OAuthButton
          provider="kakao"
          label="Kakao로 계속하기"
          onPress={() => {
            void handleOAuthLogin('kakao');
          }}
          loading={loading === 'kakao'}
          disabled={!consentAccepted}
        />
        {Platform.OS === 'ios' ? (
          <OAuthButton
            provider="apple"
            label="Apple로 계속하기"
            onPress={() => {
              void handleOAuthLogin('apple');
            }}
            loading={loading === 'apple'}
            disabled={!consentAccepted}
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

interface ConsentCheckboxProps {
  checked: boolean;
  onToggle: (next: boolean) => void;
}

function ConsentCheckbox({ checked, onToggle }: ConsentCheckboxProps) {
  // Security task #17: PIPA Article 22 requires active consent at signup.
  // The checkbox must be a positive action — pre-checked or "by signing up
  // you agree" disclosure-only patterns don't satisfy the active-consent
  // standard. Tapping anywhere on the row toggles to keep the hit target
  // generous; the inner links are tappable for the policy text without
  // toggling the checkbox.
  return (
    <Pressable
      testID="login-consent-checkbox"
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel="이용약관 및 개인정보처리방침 동의"
      onPress={() => {
        onToggle(!checked);
      }}
      style={pressedOpacity}
      className="flex-row items-start gap-3 px-2 pb-1"
    >
      <View
        className={
          checked
            ? 'mt-0.5 h-5 w-5 items-center justify-center rounded border-2 border-accent bg-accent'
            : 'mt-0.5 h-5 w-5 items-center justify-center rounded border-2 border-border bg-bg-base'
        }
      >
        {checked ? <MaterialIcons name="check" size={14} color="white" /> : null}
      </View>
      <AppText className="flex-1 text-body-sm text-text-secondary">
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
        에 동의합니다 (필수)
      </AppText>
    </Pressable>
  );
}
