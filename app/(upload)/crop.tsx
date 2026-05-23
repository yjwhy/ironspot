import { Stack } from 'expo-router';

import { UploadCropScreen } from '@/features/upload/components/UploadCropScreen';

export default function CropRoute() {
  return (
    <>
      <Stack.Screen options={{ title: '사진 자르기' }} />
      <UploadCropScreen />
    </>
  );
}
