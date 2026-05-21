import { useLocalSearchParams } from 'expo-router';

import { AdminPendingContributionScreen } from '@/features/admin/components/AdminPendingContributionScreen';

export default function AdminContributionRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AdminPendingContributionScreen gymMachineId={id} />;
}
