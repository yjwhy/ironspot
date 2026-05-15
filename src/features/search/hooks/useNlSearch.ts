import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as burnt from 'burnt';
import { useCallback, useState } from 'react';

import type { NlSearchResponse } from '@/shared/generated/model';
import { searchNatural } from '@/shared/generated/search-controller/search-controller';
import { unwrapOrvalResponse } from '@/shared/lib/orval-response';

import { searchKeys } from '../query-keys';
import { useRecentSearches } from './useRecentSearches';

interface UseNlSearchParams {
  readonly userLat: number;
  readonly userLng: number;
}

interface KyHttpErrorLike {
  readonly response?: {
    readonly status?: number;
    readonly json?: () => Promise<unknown>;
  };
}

interface ErrorBody {
  // Backend serializes `ErrorResponse(String error)` as `{ "error": "..." }`.
  readonly error?: string;
}

function statusOf(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const candidate = err as KyHttpErrorLike;
  return candidate.response?.status;
}

async function messageOf(err: unknown): Promise<string | undefined> {
  if (typeof err !== 'object' || err === null) return undefined;
  const candidate = err as KyHttpErrorLike;
  const response = candidate.response;
  if (response === undefined || typeof response.json !== 'function') return undefined;
  try {
    // Must call json() as a method so `this` is bound to the Response.
    const body = (await response.json()) as ErrorBody;
    return typeof body.error === 'string' && body.error.length > 0 ? body.error : undefined;
  } catch {
    return undefined;
  }
}

/**
 * NL Search mutation + validation error state.
 *
 * Coordinates are received as props (B-2 signature) so the hook stays pure
 * and the caller decides the fallback policy — MapScreen already resolves
 * `useCurrentLocation` to GANGNAM_STATION on loading/fallback, so this hook
 * never sees an undefined coordinate.
 *
 * Error policy:
 * - 400 (validation, e.g. "헬스장 검색만 가능해요…") → `validationError`
 *   state set with the backend message. Caller renders this inline (the
 *   recovery example needs full visibility, which a 3s native toast
 *   truncated). UX rules: error-placement (near search bar), error-recovery
 *   (example must be readable), error-clarity (cause + how-to-fix).
 * - 429 (quota), 5xx, network → toast. These are transient/retry-able and
 *   don't need a persistent recovery hint.
 *
 * Successful queries append to recent-searches via the LRU dedup in
 * useRecentSearches and clear any prior validationError.
 */
export function useNlSearch({ userLat, userLng }: UseNlSearchParams) {
  const queryClient = useQueryClient();
  const recent = useRecentSearches();
  const [validationError, setValidationError] = useState<string | undefined>(undefined);

  const clearValidationError = useCallback(() => {
    setValidationError(undefined);
  }, []);

  const mutation = useMutation<NlSearchResponse, unknown, string>({
    mutationFn: async (query) =>
      unwrapOrvalResponse(await searchNatural({ query, userLat, userLng })),
    onMutate: () => {
      // Clear any prior validation error when a new search starts so the
      // banner doesn't linger over a successful new query.
      setValidationError(undefined);
    },
    onSuccess: (data, query) => {
      queryClient.setQueryData(searchKeys.results(query), data);
      recent.add(query);
    },
    onError: async (err) => {
      const status = statusOf(err);
      if (status === 429) {
        burnt.toast({ title: '이번 달 검색 한도를 모두 사용했어요', preset: 'error' });
        return;
      }
      if (status === 400) {
        const body = await messageOf(err);
        setValidationError(body ?? '검색 조건을 다시 입력해 주세요');
        return;
      }
      burnt.toast({ title: '검색에 실패했어요. 잠시 후 다시 시도해주세요', preset: 'error' });
    },
  });

  return { ...mutation, validationError, clearValidationError };
}
