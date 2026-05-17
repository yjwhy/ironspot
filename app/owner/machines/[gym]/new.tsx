import { useLocalSearchParams, useRouter } from 'expo-router';

import { OwnerMachineForm } from '@/features/owner/components/OwnerMachineForm';

export default function OwnerMachineNewRoute() {
  const params = useLocalSearchParams<{ gym: string }>();
  const router = useRouter();
  return (
    <OwnerMachineForm
      gymId={params.gym}
      onDone={() => {
        router.back();
      }}
    />
  );
}
