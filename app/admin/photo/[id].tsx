import { useLocalSearchParams } from 'expo-router';

import { AdminPhotoScreen } from '@/features/admin/components/AdminPhotoScreen';
import { adminPhotoRouteParams, parseRouteParams } from '@/shared/lib/deeplink-params';

export default function AdminPhotoRoute() {
  // Security task #35: Zod-validate UUID at the route boundary.
  const parsed = parseRouteParams(adminPhotoRouteParams, useLocalSearchParams());
  return <AdminPhotoScreen photoId={parsed?.id ?? ''} />;
}
