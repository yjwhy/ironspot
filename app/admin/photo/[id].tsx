import { useLocalSearchParams } from 'expo-router';

import { AdminPhotoScreen } from '@/features/admin/components/AdminPhotoScreen';

export default function AdminPhotoRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AdminPhotoScreen photoId={id} />;
}
