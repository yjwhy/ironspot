import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Alert } from 'react-native';

import { useBanUser as useBanUserMutation } from '@/shared/generated/admin/admin';

import { useBanUserAction } from '../useBanUser';

jest.mock('@/shared/generated/admin/admin', () => ({ useBanUser: jest.fn() }));
jest.mock('burnt', () => ({ toast: jest.fn() }));

const useBanUserMutationMock = useBanUserMutation as jest.Mock;

function setupMutation() {
  const mutate = jest.fn();
  useBanUserMutationMock.mockImplementation(() => ({ mutate, isPending: false }));
  return { mutate };
}

function Wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useBanUserAction.confirmAndBan', () => {
  it('opens Alert with cancel and destructive options and does not mutate when cancelled', () => {
    const { mutate } = setupMutation();
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { result } = renderHook(() => useBanUserAction('u-1', 'p-1'), { wrapper: Wrapper });

    act(() => {
      result.current.confirmAndBan();
    });

    expect(alertSpy).toHaveBeenCalledTimes(1);
    const buttons = alertSpy.mock.calls[0]?.[2];
    expect(buttons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: '취소', style: 'cancel' }),
        expect.objectContaining({ text: '차단', style: 'destructive' }),
      ]),
    );
    expect(mutate).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('dispatches the ban mutation when the destructive confirm button is pressed', () => {
    const { mutate } = setupMutation();
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const destructive = buttons?.find((b) => b.style === 'destructive');
      destructive?.onPress?.();
    });
    const { result } = renderHook(() => useBanUserAction('u-1', 'p-1'), { wrapper: Wrapper });

    act(() => {
      result.current.confirmAndBan();
    });

    expect(mutate).toHaveBeenCalledWith({ id: 'u-1' });
    alertSpy.mockRestore();
  });
});
