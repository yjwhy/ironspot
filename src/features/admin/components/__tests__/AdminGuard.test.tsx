import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Text } from 'react-native';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';

import { AdminGuard } from '../AdminGuard';

jest.mock('@/features/auth/hooks/useAuth', () => ({ useAuth: jest.fn() }));
jest.mock('@/features/auth/hooks/useCurrentUser', () => ({ useCurrentUser: jest.fn() }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const useAuthMock = useAuth as jest.Mock;
const useCurrentUserMock = useCurrentUser as jest.Mock;

function Wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function ProtectedChild() {
  return <Text>protected-content</Text>;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('AdminGuard', () => {
  it('renders LoginPromptEmptyState with the admin-specific description when anonymous', () => {
    useAuthMock.mockReturnValue({ status: 'anonymous' });
    useCurrentUserMock.mockReturnValue({ data: undefined });

    render(
      <AdminGuard>
        <ProtectedChild />
      </AdminGuard>,
      { wrapper: Wrapper },
    );

    expect(screen.getByText('관리자 화면은 로그인이 필요해요')).toBeTruthy();
    expect(screen.queryByText('protected-content')).toBeNull();
  });

  it('renders the 권한이 없습니다 EmptyState when authenticated user is not an admin', () => {
    useAuthMock.mockReturnValue({ status: 'authenticated', session: {} });
    useCurrentUserMock.mockReturnValue({
      data: { id: 'u', role: 'user', nickname: 'n', email: 'e' },
    });

    render(
      <AdminGuard>
        <ProtectedChild />
      </AdminGuard>,
      { wrapper: Wrapper },
    );

    expect(screen.getByText('권한이 없습니다')).toBeTruthy();
    expect(screen.queryByText('protected-content')).toBeNull();
  });

  it('renders the protected children when authenticated user is an admin', () => {
    useAuthMock.mockReturnValue({ status: 'authenticated', session: {} });
    useCurrentUserMock.mockReturnValue({
      data: { id: 'u', role: 'admin', nickname: 'a', email: 'a' },
    });

    render(
      <AdminGuard>
        <ProtectedChild />
      </AdminGuard>,
      { wrapper: Wrapper },
    );

    expect(screen.getByText('protected-content')).toBeTruthy();
  });
});
