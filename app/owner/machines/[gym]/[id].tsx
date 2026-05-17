import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OwnerMachineForm } from '@/features/owner/components/OwnerMachineForm';
import { useListMachines } from '@/shared/generated/machines/machines';

export default function OwnerMachineEditRoute() {
  const params = useLocalSearchParams<{ gym: string; id: string }>();
  const router = useRouter();
  const machinesQuery = useListMachines(params.gym);

  const machine = machinesQuery.data?.data.find((m) => m.id === params.id);

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
      gymId={params.gym}
      initial={{ id: machine.id, templateId: machine.templateId, quantity: machine.quantity }}
      onDone={() => {
        router.back();
      }}
    />
  );
}
