import { Stack } from 'expo-router';

import { UploadGymSelectScreen } from '@/features/upload/components/UploadGymSelectScreen';

export default function GymSelectRoute() {
  return (
    <>
      <Stack.Screen options={{ title: '헬스장 선택' }} />
      <UploadGymSelectScreen />
    </>
  );
}
