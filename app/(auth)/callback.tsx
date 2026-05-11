import * as burnt from 'burnt';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AUTH_CALLBACK_TIMEOUT_MS } from '@/features/auth/constants';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { AUTH_ROUTES } from '@/features/auth/routes';
import { colors } from '@/shared/theme/tokens';

export default function AuthCallbackScreen() {
  const auth = useAuth();
  const router = useRouter();

  useEffect(
    function redirectOnAuthenticated() {
      if (auth.status === 'authenticated') {
        router.replace('/(tabs)');
      }
    },
    [auth.status, router],
  );

  useEffect(
    function timeoutGuard() {
      const id = setTimeout(() => {
        burnt.toast({ title: '로그인에 실패했습니다', preset: 'error' });
        router.replace(AUTH_ROUTES.login);
      }, AUTH_CALLBACK_TIMEOUT_MS);
      return function cleanup() {
        clearTimeout(id);
      };
    },
    [router],
  );

  return (
    <View className="flex-1 items-center justify-center bg-bg-base">
      <ActivityIndicator color={colors.accent.DEFAULT} />
    </View>
  );
}
