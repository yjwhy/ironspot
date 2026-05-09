import { Stack } from 'expo-router';

import { UploadConfirmScreen } from '@/features/upload/components/UploadConfirmScreen';

export default function ConfirmRoute() {
  return (
    <>
      <Stack.Screen options={{ title: '업로드 확인' }} />
      <UploadConfirmScreen />
    </>
  );
}
