import { Stack } from 'expo-router';

import { UploadMethodChoiceScreen } from '@/features/upload/components/UploadMethodChoiceScreen';

export default function MethodChoiceRoute() {
  return (
    <>
      <Stack.Screen options={{ title: '머신 추가' }} />
      <UploadMethodChoiceScreen />
    </>
  );
}
