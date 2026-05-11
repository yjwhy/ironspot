import { useAuth } from '@/features/auth/hooks/useAuth';

import { AuthenticatedProfile } from './AuthenticatedProfile';
import { LoginPromptEmptyState } from './LoginPromptEmptyState';
import { ProfileSkeleton } from './ProfileSkeleton';

export function ProfileScreen() {
  const auth = useAuth();

  if (auth.status === 'loading') {
    return <ProfileSkeleton />;
  }
  if (auth.status === 'anonymous') {
    return <LoginPromptEmptyState />;
  }
  return <AuthenticatedProfile />;
}
