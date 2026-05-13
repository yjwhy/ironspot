import { useAuth } from '@/features/auth/hooks/useAuth';
import { LoginPromptEmptyState } from '@/shared/components/LoginPromptEmptyState';

import { AuthenticatedProfile } from './AuthenticatedProfile';
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
