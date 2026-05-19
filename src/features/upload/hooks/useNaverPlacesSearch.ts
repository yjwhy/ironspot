import { useSearchPlaces } from '@/shared/generated/gyms/gyms';
import type { NaverPlaceResult } from '@/shared/generated/model/naverPlaceResult';

const MIN_QUERY_LENGTH = 2;

interface UseNaverPlacesSearchResult {
  places: NaverPlaceResult[];
  isFetching: boolean;
  isError: boolean;
}

/**
 * Wraps the generated `useSearchPlaces` query. The Naver proxy endpoint requires auth,
 * so this hook silently no-ops while the query is shorter than {@link MIN_QUERY_LENGTH}
 * to avoid burning quota on single-character probes.
 */
export function useNaverPlacesSearch(query: string): UseNaverPlacesSearchResult {
  const trimmed = query.trim();
  const enabled = trimmed.length >= MIN_QUERY_LENGTH;

  const { data, isFetching, isError } = useSearchPlaces(
    { query: trimmed },
    { query: { enabled, staleTime: 30_000 } },
  );

  return {
    // Double optional-chain: Orval types `data` as a `{ data, status }` wrapper
    // but apiClient returns the raw parsed body, so `data?.data` can be
    // undefined at runtime. Same pattern as useOwnerPendingDot.

    places: enabled ? (data?.data ?? []) : [],
    isFetching,
    isError: enabled && isError,
  };
}
