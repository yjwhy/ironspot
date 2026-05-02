import NetInfo from '@react-native-community/netinfo';
import { act, renderHook } from '@testing-library/react-native';

import { useNetworkStatus } from '../useNetworkStatus';

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(),
  },
}));

type NetInfoListener = (state: { isConnected: boolean | null }) => void;

function captureListener(): {
  listenerRef: { current: NetInfoListener | null };
  unsubscribe: jest.Mock;
} {
  const listenerRef: { current: NetInfoListener | null } = { current: null };
  const unsubscribe = jest.fn();
  (NetInfo.addEventListener as jest.Mock).mockImplementation((cb: NetInfoListener) => {
    listenerRef.current = cb;
    return unsubscribe;
  });
  return { listenerRef, unsubscribe };
}

describe('useNetworkStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports online by default before NetInfo fires', () => {
    (NetInfo.addEventListener as jest.Mock).mockReturnValue(() => undefined);
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.isOnline).toBe(true);
  });

  it('flips to offline when NetInfo reports isConnected=false', () => {
    const { listenerRef } = captureListener();
    const { result } = renderHook(() => useNetworkStatus());
    act(() => {
      listenerRef.current?.({ isConnected: false });
    });
    expect(result.current.isOnline).toBe(false);
  });

  it('flips back to online when NetInfo reports isConnected=true', () => {
    const { listenerRef } = captureListener();
    const { result } = renderHook(() => useNetworkStatus());
    act(() => {
      listenerRef.current?.({ isConnected: false });
    });
    act(() => {
      listenerRef.current?.({ isConnected: true });
    });
    expect(result.current.isOnline).toBe(true);
  });

  it('treats isConnected=null as online (pre-determination state)', () => {
    const { listenerRef } = captureListener();
    const { result } = renderHook(() => useNetworkStatus());
    act(() => {
      listenerRef.current?.({ isConnected: null });
    });
    expect(result.current.isOnline).toBe(true);
  });

  it('unsubscribes from NetInfo on unmount', () => {
    const { unsubscribe } = captureListener();
    const { unmount } = renderHook(() => useNetworkStatus());
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
