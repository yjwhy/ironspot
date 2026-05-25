import { useLocalSearchParams } from 'expo-router';

import { PhotoDetailScreen } from '@/features/photo/components/PhotoDetailScreen';
import { parseRouteParams, photoRouteParams } from '@/shared/lib/deeplink-params';

export default function PhotoDetailRoute() {
  // Security task #35: Zod-validate UUIDs at the route boundary.
  const parsed = parseRouteParams(photoRouteParams, useLocalSearchParams());
  return <PhotoDetailScreen photoId={parsed?.id} machineId={parsed?.machineId} />;
}
