import { MaterialIcons } from '@expo/vector-icons';
import * as burnt from 'burnt';
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/shared/components/AppText';
import { Button } from '@/shared/components/Button';
import { pressedOpacity } from '@/shared/lib/pressable';
import { supabase } from '@/shared/lib/supabase';
import { colors } from '@/shared/theme/tokens';

import { AUTH_REDIRECT_URL } from '../constants';

interface LoginScreenProps {
  onBrowseAsGuest: () => void;
}

type OAuthProvider = 'google' | 'kakao' | 'apple';
type LoadingProvider = OAuthProvider | null;

export function LoginScreen({ onBrowseAsGuest }: LoginScreenProps) {
  const [loading, setLoading] = useState<LoadingProvider>(null);

  async function handleOAuthLogin(provider: OAuthProvider) {
    setLoading(provider);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: AUTH_REDIRECT_URL },
      });
      if (error) throw error;
    } catch {
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
