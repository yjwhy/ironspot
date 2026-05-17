import { renderHook } from '@testing-library/react-native';

import { useOwnerPendingDot } from '../useOwnerPendingDot';

const mockUseAuth = jest.fn();
jest.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth() as unknown,
}));

const mockUseCurrentUser = jest.fn();
jest.mock('@/features/auth/hooks/useCurrentUser', () => ({
  useCurrentUser: () => mockUseCurrentUser() as unknown,
}));

const mockUseQueue = jest.fn();
jest.mock('@/shared/generated/owner/owner', () => ({
  useQueue: (_params: unknown, _opts: unknown) => mockUseQueue() as unknown,
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useOwnerPendingDot', () => {
  it('returns showDot=false for anonymous users', () => {
    mockUseAuth.mockReturnValue({ status: 'anonymous' });
    mockUseCurrentUser.mockReturnValue({ data: undefined });
    mockUseQueue.mockReturnValue({ data: undefined });
    const { result } = renderHook(() => useOwnerPendingDot());
    expect(result.current.showDot).toBe(false);
  });

  it('returns showDot=false for authenticated non-owners', () => {
    mockUseAuth.mockReturnValue({ status: 'authenticated', session: {} });
    mockUseCurrentUser.mockReturnValue({ data: { role: 'user' } });
    mockUseQueue.mockReturnValue({ data: undefined });
    const { result } = renderHook(() => useOwnerPendingDot());
    expect(result.current.showDot).toBe(false);
  });

  it('returns showDot=false when owner queue is empty', () => {
    mockUseAuth.mockReturnValue({ status: 'authenticated', session: {} });
    mockUseCurrentUser.mockReturnValue({ data: { role: 'owner' } });
    mockUseQueue.mockReturnValue({ data: { data: [] } });
    const { result } = renderHook(() => useOwnerPendingDot());
    expect(result.current.showDot).toBe(false);
  });

  it('returns showDot=true when owner has pending items', () => {
    mockUseAuth.mockReturnValue({ status: 'authenticated', session: {} });
    mockUseCurrentUser.mockReturnValue({ data: { role: 'owner' } });
    mockUseQueue.mockReturnValue({ data: { data: [{ reportId: 'r1' }] } });
    const { result } = renderHook(() => useOwnerPendingDot());
    expect(result.current.showDot).toBe(true);
  });

  it('also flips showDot=true for admin role with pending items', () => {
    mockUseAuth.mockReturnValue({ status: 'authenticated', session: {} });
    mockUseCurrentUser.mockReturnValue({ data: { role: 'admin' } });
    mockUseQueue.mockReturnValue({ data: { data: [{ reportId: 'r1' }] } });
    const { result } = renderHook(() => useOwnerPendingDot());
    expect(result.current.showDot).toBe(true);
  });
});
