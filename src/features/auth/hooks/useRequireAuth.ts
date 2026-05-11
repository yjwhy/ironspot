import { useRouter } from 'expo-router';

import { AUTH_ROUTES } from '../routes';
import { useAuth } from './useAuth';

export function useRequireAuth() {
  const auth = useAuth();
  const router = useRouter();

  return function requireAuth(action: () => void): void {
    if (auth.status === 'loading') return;
    if (auth.status === 'authenticated') {
      action();
    } else {
      router.push(AUTH_ROUTES.login);
    }
  };
}
