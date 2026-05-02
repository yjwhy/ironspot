import { useLocalSearchParams } from 'expo-router';

import { PhotoDetailScreen } from '@/features/photo/components/PhotoDetailScreen';

export default function PhotoDetailRoute() {
  const params = useLocalSearchParams<{ id?: string; machineId?: string }>();
  const photoId = typeof params.id === 'string' ? params.id : undefined;
  const machineId = typeof params.machineId === 'string' ? params.machineId : undefined;
  return <PhotoDetailScreen photoId={photoId} machineId={machineId} />;
}
