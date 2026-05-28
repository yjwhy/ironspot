import { Stack } from 'expo-router';

import { UploadMachinePhotoScreen } from '@/features/upload/components/UploadMachinePhotoScreen';

export default function MachinePhotoRoute() {
  return (
    <>
      <Stack.Screen options={{ title: '머신 사진' }} />
      <UploadMachinePhotoScreen />
    </>
  );
}
