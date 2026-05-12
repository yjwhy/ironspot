import { useAuth } from '@/features/auth/hooks/useAuth';

import { AuthenticatedProfile } from './AuthenticatedProfile';
import { LoginPromptEmptyState } from './LoginPromptEmptyState';
import { ProfileSkeleton } from './ProfileSkeleton';
import { SentrySmokeButton } from './SentrySmokeButton';

export function ProfileScreen() {
  const auth = useAuth();

  if (auth.status === 'loading') {
    return (
      <>
        <ProfileSkeleton />
        <SentrySmokeButton />
      </>
    );
  }
  if (auth.status === 'anonymous') {
    return (
      <>
        <LoginPromptEmptyState />
        <SentrySmokeButton />
      </>
    );
  }
  return (
    <>
      <AuthenticatedProfile />
      <SentrySmokeButton />
    </>
  );
}
