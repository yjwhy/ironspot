import type { ReactNode } from 'react';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { EmptyState } from '@/shared/components/EmptyState';
import { LoginPromptEmptyState } from '@/shared/components/LoginPromptEmptyState';

const OWNER_LOGIN_DESCRIPTION = 'owner 도구는 로그인이 필요해요';
const OWNER_FORBIDDEN_TITLE = 'owner 권한이 없어요';
const OWNER_FORBIDDEN_DESCRIPTION = '매장 인증을 먼저 진행해 주세요';

interface Props {
  children: ReactNode;
}

export function OwnerGuard({ children }: Props) {
  const auth = useAuth();
  const { data: user } = useCurrentUser();

  if (auth.status === 'anonymous') {
    return <LoginPromptEmptyState description={OWNER_LOGIN_DESCRIPTION} />;
  }
  if (auth.status === 'loading' || user === undefined) {
    return null;
  }
  // Admins may enter the owner surface for moderation/observation. Anyone else
  // without the owner role is bounced to the claim path.
  if (user.role !== 'owner' && user.role !== 'admin') {
    return (
      <EmptyState
        icon="store"
        title={OWNER_FORBIDDEN_TITLE}
        description={OWNER_FORBIDDEN_DESCRIPTION}
      />
    );
  }
  return <>{children}</>;
}
