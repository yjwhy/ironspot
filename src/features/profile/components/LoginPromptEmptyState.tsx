import { router } from 'expo-router';

import { Button } from '@/shared/components/Button';
import { EmptyState } from '@/shared/components/EmptyState';

const LOGIN_PROMPT_TITLE = '로그인이 필요해요';
const LOGIN_PROMPT_DESCRIPTION = '내 사진과 추천 목록을 보려면 로그인하세요';
const LOGIN_PROMPT_CTA = '로그인하기';

function handleNavigateToLogin() {
  router.push('/(auth)/login');
}

export function LoginPromptEmptyState() {
  return (
    <EmptyState
      icon="person-outline"
      title={LOGIN_PROMPT_TITLE}
      description={LOGIN_PROMPT_DESCRIPTION}
      action={<Button label={LOGIN_PROMPT_CTA} onPress={handleNavigateToLogin} />}
    />
  );
}
