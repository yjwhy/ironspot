import { QueryClient } from '@tanstack/react-query';

const FIVE_MINUTES_MS = 1000 * 60 * 5;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: FIVE_MINUTES_MS,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});
