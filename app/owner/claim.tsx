import { useLocalSearchParams } from 'expo-router';

import { OwnerClaimScreen } from '@/features/owner/components/OwnerClaimScreen';
import { ownerClaimParams, parseRouteParams } from '@/shared/lib/deeplink-params';

export default function OwnerClaimRoute() {
  // Security task #35: Zod-validate UUID + bounded gymName at the route
  // boundary so a deep link can't smuggle control characters into the
  // OwnerClaimScreen header.
  const parsed = parseRouteParams(ownerClaimParams, useLocalSearchParams());
  return <OwnerClaimScreen gymId={parsed?.gymId ?? ''} gymName={parsed?.gymName ?? '이 매장'} />;
}
