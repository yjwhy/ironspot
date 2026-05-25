import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OwnerMachineForm } from '@/features/owner/components/OwnerMachineForm';
import { useListMachines } from '@/shared/generated/machines/machines';
import { ownerMachineDetailParams, parseRouteParams } from '@/shared/lib/deeplink-params';

export default function OwnerMachineEditRoute() {
  // Security task #35: Zod-validate UUIDs at the route boundary.
  const parsed = parseRouteParams(ownerMachineDetailParams, useLocalSearchParams());
  const router = useRouter();
  const machinesQuery = useListMachines(parsed?.gym ?? '');

  const machine = machinesQuery.data?.data.find((m) => m.id === parsed?.id);

  if (machinesQuery.isLoading || machine === undefined) {
    return (
      <SafeAreaView className="flex-1 bg-bg-base items-center justify-center">
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (typeof machine.templateId !== 'string') {
    // Custom (non-template) machines cannot be edited through this form yet —
    // OwnerCreate/UpdateMachineRequest both require templateId.
    return null;
  }

  return (
    <OwnerMachineForm
      gymId={parsed?.gym ?? ''}
      initial={{ id: machine.id, templateId: machine.templateId, quantity: machine.quantity }}
      onDone={() => {
        router.back();
      }}
    />
  );
}
