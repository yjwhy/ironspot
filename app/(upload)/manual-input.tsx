import { Stack } from 'expo-router';

import { UploadManualInputScreen } from '@/features/upload/components/UploadManualInputScreen';

export default function ManualInputRoute() {
  return (
    <>
      <Stack.Screen options={{ title: '직접 입력' }} />
      <UploadManualInputScreen />
    </>
  );
}
