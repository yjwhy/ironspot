import { useAuth } from './useAuth';

export function useAuthenticatedUserId(): string | null {
  const auth = useAuth();
  return auth.status === 'authenticated' ? auth.session.user.id : null;
}
