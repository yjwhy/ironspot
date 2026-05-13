import { Stack } from 'expo-router';

import { AdminGuard } from '@/features/admin/components/AdminGuard';

export default function AdminLayout() {
  return (
    <AdminGuard>
      <Stack screenOptions={{ headerShown: false }} />
    </AdminGuard>
  );
}
