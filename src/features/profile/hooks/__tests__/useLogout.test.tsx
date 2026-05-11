import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useLogout } from '../useLogout';

jest.mock('@/shared/lib/supabase', () => ({
  supabase: {
    auth: { signOut: jest.fn() },
  },
}));
jest.mock('burnt', () => ({
  toast: jest.fn(),
}));

function getSupabaseMock() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@/shared/lib/supabase') as {
    supabase: { auth: { signOut: jest.Mock } };
  };
}
function getBurntMock() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('burnt') as { toast: jest.Mock };
}

function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['users', 'me', 'u-1'], { nickname: 'before' });

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { Wrapper, client };
}

beforeEach(() => {
  jest.clearAllMocks();
  getSupabaseMock().supabase.auth.signOut.mockResolvedValue({ error: null });
});

describe('useLogout', () => {
  it('signs out, clears query cache, and shows success toast', async () => {
    const { Wrapper, client } = createWrapper();
    expect(client.getQueryData(['users', 'me', 'u-1'])).toEqual({ nickname: 'before' });

    const { result } = renderHook(() => useLogout(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.handleLogout();
    });

    expect(getSupabaseMock().supabase.auth.signOut).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(['users', 'me', 'u-1'])).toBeUndefined();
    expect(getBurntMock().toast).toHaveBeenCalledWith({
      title: '로그아웃했습니다',
      preset: 'done',
    });
  });

  it('shows error toast, rejects, and does not clear cache when signOut fails', async () => {
    const signOutError = new Error('boom');
    getSupabaseMock().supabase.auth.signOut.mockResolvedValue({ error: signOutError });
    const { Wrapper, client } = createWrapper();

    const { result } = renderHook(() => useLogout(), { wrapper: Wrapper });

    let rejection: unknown;
    await act(async () => {
      rejection = await result.current.handleLogout().catch((e: unknown) => e);
    });

    expect(rejection).toBe(signOutError);
    expect(client.getQueryData(['users', 'me', 'u-1'])).toEqual({ nickname: 'before' });
    expect(getBurntMock().toast).toHaveBeenCalledWith({
      title: '로그아웃에 실패했습니다',
      preset: 'error',
    });
  });

  it('reports pending state while sign-out is in flight', async () => {
    let resolveSignOut: (value: { error: null }) => void = () => undefined;
    getSupabaseMock().supabase.auth.signOut.mockReturnValue(
      new Promise((resolve) => {
        resolveSignOut = resolve;
      }),
    );

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useLogout(), { wrapper: Wrapper });

    let logoutPromise: Promise<void> = Promise.resolve();
    act(() => {
      logoutPromise = result.current.handleLogout();
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
    });

    await act(async () => {
      resolveSignOut({ error: null });
      await logoutPromise;
    });

    expect(result.current.isPending).toBe(false);
  });
});
