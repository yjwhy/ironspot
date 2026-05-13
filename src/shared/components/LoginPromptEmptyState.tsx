import { router } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AUTH_ROUTES } from '@/features/auth/routes';
import { Button } from '@/shared/components/Button';
import { EmptyState } from '@/shared/components/EmptyState';

const LOGIN_PROMPT_TITLE = '로그인이 필요해요';
const LOGIN_PROMPT_DEFAULT_DESCRIPTION = '내 사진과 추천 목록을 보려면 로그인하세요';
const LOGIN_PROMPT_CTA = '로그인하기';

interface Props {
  description?: string;
}

function handleNavigateToLogin() {
  router.push(AUTH_ROUTES.login);
}

export function LoginPromptEmptyState({
  description = LOGIN_PROMPT_DEFAULT_DESCRIPTION,
}: Props = {}) {
  return (
    <SafeAreaView className="flex-1 bg-bg-base">
      <View className="flex-1 items-center justify-center">
        <EmptyState
          icon="person-outline"
          title={LOGIN_PROMPT_TITLE}
          description={description}
          action={<Button label={LOGIN_PROMPT_CTA} onPress={handleNavigateToLogin} />}
        />
      </View>
    </SafeAreaView>
  );
}
