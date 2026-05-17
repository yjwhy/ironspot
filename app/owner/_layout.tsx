import { Stack } from 'expo-router';

import { OwnerGuard } from '@/features/owner/components/OwnerGuard';

export default function OwnerLayout() {
  return (
    <OwnerGuard>
      <Stack screenOptions={{ headerShown: false }} />
    </OwnerGuard>
  );
}
