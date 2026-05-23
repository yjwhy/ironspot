import { Stack } from 'expo-router';

import { UploadMachinePhotoScreen } from '@/features/upload/components/UploadMachinePhotoScreen';

export default function MachinePhotoRoute() {
  return (
    <>
      <Stack.Screen options={{ title: '기구 사진' }} />
      <UploadMachinePhotoScreen />
    </>
  );
}
