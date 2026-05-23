import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { apiClient } from '@/shared/lib/api-client';

import { useTransliterateBrand } from '../useTransliterateBrand';

jest.mock('@/shared/lib/api-client', () => ({
  apiClient: jest.fn(),
}));

jest.mock('burnt', () => ({ toast: jest.fn() }));

const apiClientMock = apiClient as jest.MockedFunction<typeof apiClient>;

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  apiClientMock.mockReset();
});

describe('useTransliterateBrand', () => {
  it('POSTs to /api/admin/transliterate-brand and returns the suggestion', async () => {
    apiClientMock.mockResolvedValue({ name: 'Cybex', nameKo: '사이벡스' });

    const { result } = renderHook(() => useTransliterateBrand({ onSuccess: jest.fn() }), {
      wrapper: makeWrapper(),
    });

    let suggestion: { name: string; nameKo: string } | undefined;
    await act(async () => {
      suggestion = await result.current.mutateAsync({ name: 'Cybex' });
    });

    expect(apiClientMock).toHaveBeenCalledWith(
      'api/admin/transliterate-brand',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Cybex' }),
      }),
    );
    expect(suggestion).toEqual({ name: 'Cybex', nameKo: '사이벡스' });
  });

  it('lets network errors propagate to the awaiter while staying mounted', async () => {
    apiClientMock.mockRejectedValue(new Error('network'));

    const { result } = renderHook(() => useTransliterateBrand({ onSuccess: jest.fn() }), {
      wrapper: makeWrapper(),
    });

    let thrown: Error | undefined;
    await act(async () => {
      try {
        await result.current.mutateAsync({ nameKo: '해머 스트렝스' });
      } catch (e) {
        thrown = e as Error;
      }
    });

    expect(thrown?.message).toBe('network');
  });
});
