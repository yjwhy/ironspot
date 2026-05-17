import { useLocalSearchParams } from 'expo-router';

import { OwnerClaimScreen } from '@/features/owner/components/OwnerClaimScreen';

export default function OwnerClaimRoute() {
  const params = useLocalSearchParams<{ gymId: string; gymName?: string }>();
  return <OwnerClaimScreen gymId={params.gymId} gymName={params.gymName ?? '이 매장'} />;
}
