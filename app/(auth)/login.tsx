import { useRouter } from 'expo-router';

import { LoginScreen } from '@/features/auth/components/LoginScreen';

export default function LoginRoute() {
  const router = useRouter();

  function handleBrowseAsGuest() {
    router.replace('/(tabs)');
  }

  function handleAuthenticated() {
    router.replace('/(tabs)');
  }

  return (
    <LoginScreen onBrowseAsGuest={handleBrowseAsGuest} onAuthenticated={handleAuthenticated} />
  );
}
