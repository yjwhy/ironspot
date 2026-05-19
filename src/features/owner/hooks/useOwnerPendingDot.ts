import { useAuth } from '@/features/auth/hooks/useAuth';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { useQueue } from '@/shared/generated/owner/owner';

interface UseOwnerPendingDotResult {
  showDot: boolean;
}

const QUEUE_PROBE_LIMIT = 1;

/**
 * Task 47 / ADR 0023 Q6 E5: drives the Profile tab dot badge. Returns
 * {showDot: true} only when (a) the user is authenticated, (b) the /me
 * query says they are an owner or admin, and (c) at least one report sits
 * in their pending queue. The query is gated on role to keep anonymous /
 * regular-user tab bars free from owner endpoint traffic.
 */
export function useOwnerPendingDot(): UseOwnerPendingDotResult {
  const auth = useAuth();
  const userQuery = useCurrentUser();
  const isAuthenticated = auth.status === 'authenticated';
  const role = userQuery.data?.role;
  const isOwnerLike = role === 'owner' || role === 'admin';
  const enabled = isAuthenticated && isOwnerLike;

  const queueQuery = useQueue({ limit: QUEUE_PROBE_LIMIT }, { query: { enabled } });
  // Double optional-chain: Orval types `queueResponse` as a wrapper but the
  // apiClient returns the raw parsed body, so `queueQuery.data?.data` can be
  // undefined at runtime even when `queueQuery.data` is truthy. Matches the
  // `?.data ?? []` pattern used in OwnerHomeScreen / OwnerQueueScreen.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const pendingCount = queueQuery.data?.data?.length ?? 0;
  return { showDot: enabled && pendingCount > 0 };
}
