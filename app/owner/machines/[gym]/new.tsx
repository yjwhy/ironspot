import { useLocalSearchParams, useRouter } from 'expo-router';

import { OwnerMachineForm } from '@/features/owner/components/OwnerMachineForm';
import { ownerMachineNewParams, parseRouteParams } from '@/shared/lib/deeplink-params';

export default function OwnerMachineNewRoute() {
  // Security task #35: Zod-validate UUID at the route boundary.
  const parsed = parseRouteParams(ownerMachineNewParams, useLocalSearchParams());
  const router = useRouter();
  return (
    <OwnerMachineForm
      gymId={parsed?.gym ?? ''}
      onDone={() => {
        router.back();
      }}
    />
  );
}
