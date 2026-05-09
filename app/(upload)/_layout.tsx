import { Stack } from 'expo-router';

export default function UploadLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: '뒤로',
      }}
    />
  );
}
