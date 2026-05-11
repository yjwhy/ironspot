import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

import { HTTPError, TimeoutError } from './api-client';
import { captureError } from './sentry';

export const STALE_TIME_DEFAULT_MS = 1000 * 60 * 5;

// Report server faults and degraded-backend signals to Sentry. 4xx (validation, auth, not-found)
// is user-impact noise — component-level onError already routes it to toast / inline UI.
// Component handlers continue to receive everything; this only affects the Sentry boundary.
//
// 429 included intentionally: a spike of rate-limit responses is either an attack signal or a
// missing client-side throttle — both worth a Sentry event.
function shouldReportToSentry(error: unknown): boolean {
  if (error instanceof HTTPError) {
    return error.response.status >= 500 || error.response.status === 429;
  }
  if (error instanceof TimeoutError) {
    return true;
  }
  // fetch network failures (DNS, offline, server unreachable) surface as TypeError.
  if (error instanceof TypeError) {
    return true;
  }
  return false;
}

function reportErrorToSentry(error: unknown): void {
  if (shouldReportToSentry(error)) captureError(error);
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_TIME_DEFAULT_MS,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
  queryCache: new QueryCache({ onError: reportErrorToSentry }),
  mutationCache: new MutationCache({ onError: reportErrorToSentry }),
});
