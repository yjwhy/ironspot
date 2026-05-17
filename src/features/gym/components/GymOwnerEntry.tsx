import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { AppText } from '@/shared/components/AppText';
import { useQueue } from '@/shared/generated/owner/owner';
import { pressedOpacity } from '@/shared/lib/pressable';

interface GymOwnerEntryProps {
  gymId: string;
  gymName: string;
}

// Task 47 / ADR 0023 Q6 E3+R2: gym detail entry points for owner workflows.
// Behaviour matrix:
//   anonymous       → null (claim path is gated by auth)
//   user            → "내 매장이에요" → /owner/claim?gymId=...&gymName=...
//   owner-of-gym    → "owner 도구" → /owner/machines/[gym]
//   admin           → "admin 검토" → owner machines view (same target as owner)
//   owner-of-other-gym → user-style claim button (multi-claim allowed)
//
// Owned-gym detection uses /api/owner/queue items; if the user owns this gym
// AND has pending reports there, the row will surface. For owners with no
// pending reports we still want the button — so we additionally treat any
// queue entry referencing gymId as ownership evidence, otherwise fall back
// to the claim CTA.
export function GymOwnerEntry({ gymId, gymName }: GymOwnerEntryProps) {
  const userQuery = useCurrentUser();
  const role = userQuery.data?.role;
  // userQuery.data === undefined covers both anonymous and loading. We hide
  // both buttons in that case so the Profile/login path remains the only
  // entry point (matches existing pre-Task 47 GymDetail behaviour).
  const isAuthenticated = userQuery.data !== undefined;
  const isOwnerLike = role === 'owner' || role === 'admin';

  const queueQuery = useQueue(
    { limit: 100 },
    { query: { enabled: isAuthenticated && isOwnerLike } },
  );
  const isOwnedByMe = (queueQuery.data?.data ?? []).some((item) => item.gymId === gymId);

  if (!isAuthenticated) {
    return null;
  }

  function navigateToOwnerMachines() {
    router.push({ pathname: '/owner/machines/[gym]', params: { gym: gymId } });
  }

  function navigateToClaim() {
    router.push({ pathname: '/owner/claim', params: { gymId, gymName } });
  }

  if (isOwnerLike && isOwnedByMe) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="owner 도구"
        onPress={navigateToOwnerMachines}
        style={pressedOpacity}
        testID="gym-owner-tools-button"
        className="mt-2 rounded-lg bg-accent px-4 py-3 items-center"
      >
        <AppText className="text-body font-semibold text-white">owner 도구</AppText>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="내 매장이에요"
      onPress={navigateToClaim}
      style={pressedOpacity}
      testID="gym-claim-button"
      className="mt-2 rounded-lg border border-accent px-4 py-3 items-center"
    >
      <View>
        <AppText className="text-body font-semibold text-accent">내 매장이에요</AppText>
      </View>
    </Pressable>
  );
}
