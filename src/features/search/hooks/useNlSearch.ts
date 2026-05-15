import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as burnt from 'burnt';

import type { NlSearchResponse } from '@/shared/generated/model';
import { searchNatural } from '@/shared/generated/search-controller/search-controller';

import { searchKeys } from '../query-keys';
import { useRecentSearches } from './useRecentSearches';

interface UseNlSearchParams {
  readonly userLat: number;
  readonly userLng: number;
}

interface KyHttpErrorLike {
  readonly response?: { readonly status?: number };
}

function statusOf(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const candidate = err as KyHttpErrorLike;
  return candidate.response?.status;
}

/**
 * NL Search mutation. Coordinates are received as props (B-2 signature) so
 * the hook stays pure and the caller decides the fallback policy — MapScreen
 * already resolves `useCurrentLocation` to GANGNAM_STATION on loading/
 * fallback, so this hook never sees an undefined coordinate.
 *
 * 429/400/5xx error paths surface distinct Korean toasts. Successful queries
 * append to recent-searches via the LRU dedup in useRecentSearches.
 */
export function useNlSearch({ userLat, userLng }: UseNlSearchParams) {
  const queryClient = useQueryClient();
  const recent = useRecentSearches();

  return useMutation<NlSearchResponse, unknown, string>({
    mutationFn: async (query) => {
      const { data } = await searchNatural({ query, userLat, userLng });
      return data;
    },
    onSuccess: (data, query) => {
      queryClient.setQueryData(searchKeys.results(query), data);
      recent.add(query);
    },
    onError: (err) => {
      const status = statusOf(err);
      if (status === 429) {
        burnt.toast({ title: '이번 달 검색 한도를 모두 사용했어요', preset: 'error' });
      } else if (status === 400) {
        burnt.toast({ title: '검색 조건을 다시 입력해 주세요', preset: 'error' });
      } else {
        burnt.toast({ title: '검색에 실패했어요. 잠시 후 다시 시도해주세요', preset: 'error' });
      }
    },
  });
}
