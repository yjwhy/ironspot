import { Stack } from 'expo-router';

import { UploadPhotoScreen } from '@/features/upload/components/UploadPhotoScreen';

export default function PhotoRoute() {
  return (
    <>
      <Stack.Screen options={{ title: '사진 촬영' }} />
      <UploadPhotoScreen />
    </>
  );
}
