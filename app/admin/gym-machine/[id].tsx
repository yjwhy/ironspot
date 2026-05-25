import { useLocalSearchParams } from 'expo-router';

import { AdminGymMachineScreen } from '@/features/admin/components/AdminGymMachineScreen';
import { adminGymMachineRouteParams, parseRouteParams } from '@/shared/lib/deeplink-params';

export default function AdminGymMachineRoute() {
  // Security task #35: Zod-validate UUID at the route boundary.
  const parsed = parseRouteParams(adminGymMachineRouteParams, useLocalSearchParams());
  return <AdminGymMachineScreen gymMachineId={parsed?.id ?? ''} />;
}
