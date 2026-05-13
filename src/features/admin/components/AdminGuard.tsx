import type { ReactNode } from 'react';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { EmptyState } from '@/shared/components/EmptyState';
import { LoginPromptEmptyState } from '@/shared/components/LoginPromptEmptyState';

const ADMIN_LOGIN_DESCRIPTION = '관리자 화면은 로그인이 필요해요';
const ADMIN_FORBIDDEN_TITLE = '권한이 없습니다';

interface Props {
  children: ReactNode;
}

export function AdminGuard({ children }: Props) {
  const auth = useAuth();
  const { data: user } = useCurrentUser();

  if (auth.status === 'anonymous') {
    return <LoginPromptEmptyState description={ADMIN_LOGIN_DESCRIPTION} />;
  }
  // While auth resolves or the /me query is in flight, render nothing — the
  // surrounding screen-level skeleton already covers the visible loading state.
  if (auth.status === 'loading' || user === undefined) {
    return null;
  }
  if (user.role !== 'admin') {
    return <EmptyState icon="lock-outline" title={ADMIN_FORBIDDEN_TITLE} />;
  }
  return <>{children}</>;
}
