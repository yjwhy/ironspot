import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Text } from 'react-native';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';

import { OwnerGuard } from '../OwnerGuard';

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
  return <Text>owner-protected</Text>;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('OwnerGuard', () => {
  it('renders the login prompt when anonymous', () => {
    useAuthMock.mockReturnValue({ status: 'anonymous' });
    useCurrentUserMock.mockReturnValue({ data: undefined });

    render(
      <OwnerGuard>
        <ProtectedChild />
      </OwnerGuard>,
      { wrapper: Wrapper },
    );

    expect(screen.getByText('owner 도구는 로그인이 필요해요')).toBeTruthy();
    expect(screen.queryByText('owner-protected')).toBeNull();
  });

  it('renders the forbidden state when the user is not owner or admin', () => {
    useAuthMock.mockReturnValue({ status: 'authenticated', session: {} });
    useCurrentUserMock.mockReturnValue({
      data: { id: 'u', role: 'user', nickname: 'n', email: 'e' },
    });

    render(
      <OwnerGuard>
        <ProtectedChild />
      </OwnerGuard>,
      { wrapper: Wrapper },
    );

    expect(screen.getByText('owner 권한이 없어요')).toBeTruthy();
    expect(screen.queryByText('owner-protected')).toBeNull();
  });

  it('renders children when the user is an owner', () => {
    useAuthMock.mockReturnValue({ status: 'authenticated', session: {} });
    useCurrentUserMock.mockReturnValue({
      data: { id: 'u', role: 'owner', nickname: 'o', email: 'o' },
    });

    render(
      <OwnerGuard>
        <ProtectedChild />
      </OwnerGuard>,
      { wrapper: Wrapper },
    );

    expect(screen.getByText('owner-protected')).toBeTruthy();
  });

  it('renders children when the user is an admin (admins may inspect)', () => {
    useAuthMock.mockReturnValue({ status: 'authenticated', session: {} });
    useCurrentUserMock.mockReturnValue({
      data: { id: 'u', role: 'admin', nickname: 'a', email: 'a' },
    });

    render(
      <OwnerGuard>
        <ProtectedChild />
      </OwnerGuard>,
      { wrapper: Wrapper },
    );

    expect(screen.getByText('owner-protected')).toBeTruthy();
  });
});
