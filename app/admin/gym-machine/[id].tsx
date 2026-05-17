import { useLocalSearchParams } from 'expo-router';

import { AdminGymMachineScreen } from '@/features/admin/components/AdminGymMachineScreen';

export default function AdminGymMachineRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AdminGymMachineScreen gymMachineId={id} />;
}
