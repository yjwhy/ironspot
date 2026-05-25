import { useLocalSearchParams } from 'expo-router';

import { AdminPendingContributionScreen } from '@/features/admin/components/AdminPendingContributionScreen';
import { adminContributionRouteParams, parseRouteParams } from '@/shared/lib/deeplink-params';

export default function AdminContributionRoute() {
  // Security task #35: Zod-validate UUIDs at the route boundary.
  const parsed = parseRouteParams(adminContributionRouteParams, useLocalSearchParams());
  return <AdminPendingContributionScreen gymMachineId={parsed?.id ?? ''} />;
}
