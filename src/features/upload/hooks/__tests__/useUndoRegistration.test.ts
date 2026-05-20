import { act, renderHook } from '@testing-library/react-native';
import { toast } from 'burnt';

import { useDeleteGym } from '@/shared/generated/gyms/gyms';

import { useUndoRegistration } from '../useUndoRegistration';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('burnt', () => ({
  toast: jest.fn(),
}));

jest.mock('@/shared/generated/gyms/gyms', () => ({
  useDeleteGym: jest.fn(),
}));

const mockUseDeleteGym = useDeleteGym as jest.MockedFunction<typeof useDeleteGym>;
const mockToast = toast as jest.MockedFunction<typeof toast>;

interface DeleteGymStub {
  mutate: jest.Mock;
  isPending: boolean;
  capturedOnSuccess: (() => void) | null;
  capturedOnError: (() => void) | null;
}

function stubDeleteGym(initialPending = false): DeleteGymStub {
  const stub: DeleteGymStub = {
    mutate: jest.fn(),
    isPending: initialPending,
    capturedOnSuccess: null,
    capturedOnError: null,
  };
  mockUseDeleteGym.mockImplementation((options) => {
    stub.capturedOnSuccess = options?.mutation?.onSuccess ?? null;
    stub.capturedOnError = options?.mutation?.onError ?? null;
    // The hook only reads `mutate` + `isPending`, so a focused partial
    // cast keeps the stub honest without dragging in the full
    // UseMutationResult shape.
    return {
      mutate: stub.mutate,
      isPending: stub.isPending,
    } as unknown as ReturnType<typeof useDeleteGym>;
  });
  return stub;
}

describe('useUndoRegistration', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockReplace.mockClear();
    mockToast.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts visible and auto-dismisses after the duration elapses', () => {
    stubDeleteGym();
    const { result } = renderHook(() => useUndoRegistration({ gymId: 'gym-1', durationMs: 5000 }));

    expect(result.current.isVisible).toBe(true);

    act(() => {
      jest.advanceTimersByTime(4999);
    });
    expect(result.current.isVisible).toBe(true);

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current.isVisible).toBe(false);
  });

  it('handleUndo hides the toast immediately and fires deleteGym mutation', () => {
    const stub = stubDeleteGym();
    const { result } = renderHook(() => useUndoRegistration({ gymId: 'gym-42', durationMs: 5000 }));

    act(() => {
      result.current.handleUndo();
    });

    expect(result.current.isVisible).toBe(false);
    expect(stub.mutate).toHaveBeenCalledWith({ id: 'gym-42' });
  });

  it('navigates back to map on successful undo', () => {
    const stub = stubDeleteGym();
    renderHook(() => useUndoRegistration({ gymId: 'gym-1', durationMs: 5000 }));

    expect(mockReplace).not.toHaveBeenCalled();
    act(() => {
      stub.capturedOnSuccess?.();
    });
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('surfaces a burnt error toast on delete failure and does not navigate', () => {
    const stub = stubDeleteGym();
    renderHook(() => useUndoRegistration({ gymId: 'gym-1', durationMs: 5000 }));

    act(() => {
      stub.capturedOnError?.();
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: '등록 취소 실패',
      message: '잠시 후 다시 시도해주세요',
      preset: 'error',
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('clears the timer on unmount so the gym row stays if user navigates away', () => {
    stubDeleteGym();
    const { unmount } = renderHook(() => useUndoRegistration({ gymId: 'gym-1', durationMs: 5000 }));

    unmount();
    act(() => {
      jest.advanceTimersByTime(10000);
    });
    // No assertions fail = no setState after unmount = timer correctly cleared.
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('exposes isPending from the mutation state', () => {
    stubDeleteGym(true);
    const { result } = renderHook(() => useUndoRegistration({ gymId: 'gym-1', durationMs: 5000 }));

    expect(result.current.isPending).toBe(true);
  });
});
