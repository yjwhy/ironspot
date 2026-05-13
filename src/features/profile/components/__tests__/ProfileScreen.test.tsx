import { render } from '@testing-library/react-native';

import { useAuth } from '@/features/auth/hooks/useAuth';

import { ProfileScreen } from '../ProfileScreen';

jest.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../AuthenticatedProfile', () => ({
  AuthenticatedProfile: jest.fn(() => null),
}));
jest.mock('@/shared/components/LoginPromptEmptyState', () => ({
  LoginPromptEmptyState: jest.fn(() => null),
}));
jest.mock('../ProfileSkeleton', () => ({
  ProfileSkeleton: jest.fn(() => null),
}));

const useAuthMock = useAuth as jest.Mock;

function getMocks() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const authenticated = require('../AuthenticatedProfile') as {
    AuthenticatedProfile: jest.Mock;
  };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const login = require('@/shared/components/LoginPromptEmptyState') as {
    LoginPromptEmptyState: jest.Mock;
  };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const skeleton = require('../ProfileSkeleton') as { ProfileSkeleton: jest.Mock };
  return {
    AuthenticatedProfile: authenticated.AuthenticatedProfile,
    LoginPromptEmptyState: login.LoginPromptEmptyState,
    ProfileSkeleton: skeleton.ProfileSkeleton,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ProfileScreen', () => {
  it('renders skeleton while auth is loading', () => {
    useAuthMock.mockReturnValue({ status: 'loading' });
    render(<ProfileScreen />);
    const { ProfileSkeleton, LoginPromptEmptyState, AuthenticatedProfile } = getMocks();
    expect(ProfileSkeleton).toHaveBeenCalled();
    expect(LoginPromptEmptyState).not.toHaveBeenCalled();
    expect(AuthenticatedProfile).not.toHaveBeenCalled();
  });

  it('renders login prompt when anonymous', () => {
    useAuthMock.mockReturnValue({ status: 'anonymous' });
    render(<ProfileScreen />);
    const { ProfileSkeleton, LoginPromptEmptyState, AuthenticatedProfile } = getMocks();
    expect(LoginPromptEmptyState).toHaveBeenCalled();
    expect(ProfileSkeleton).not.toHaveBeenCalled();
    expect(AuthenticatedProfile).not.toHaveBeenCalled();
  });

  it('renders authenticated profile when authenticated', () => {
    useAuthMock.mockReturnValue({ status: 'authenticated', session: {} });
    render(<ProfileScreen />);
    const { ProfileSkeleton, LoginPromptEmptyState, AuthenticatedProfile } = getMocks();
    expect(AuthenticatedProfile).toHaveBeenCalled();
    expect(ProfileSkeleton).not.toHaveBeenCalled();
    expect(LoginPromptEmptyState).not.toHaveBeenCalled();
  });
});
