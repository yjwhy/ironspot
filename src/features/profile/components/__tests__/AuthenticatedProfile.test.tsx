import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';

import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';

import { useLogout } from '../../hooks/useLogout';
import { useMyPhotos } from '../../hooks/useMyPhotos';
import { useMyVotes } from '../../hooks/useMyVotes';
import { AuthenticatedProfile } from '../AuthenticatedProfile';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

jest.mock('@/features/auth/hooks/useCurrentUser', () => ({
  useCurrentUser: jest.fn(),
}));
jest.mock('../../hooks/useMyPhotos', () => ({
  useMyPhotos: jest.fn(),
}));
jest.mock('../../hooks/useMyVotes', () => ({
  useMyVotes: jest.fn(),
}));
jest.mock('../../hooks/useLogout', () => ({
  useLogout: jest.fn(),
}));

// Task 47 / Slice 47l: OwnerActivityWidget consumes useQueue. Stub the Orval
// hook to keep the existing AuthenticatedProfile suite focused on its own
// behaviour (the widget's pending-state branches are covered separately).
jest.mock('@/shared/generated/owner/owner', () => ({
  useQueue: () => ({ data: undefined }),
}));

const useCurrentUserMock = useCurrentUser as jest.Mock;
const useMyPhotosMock = useMyPhotos as jest.Mock;
const useMyVotesMock = useMyVotes as jest.Mock;
const useLogoutMock = useLogout as jest.Mock;
const routerPushMock = router.push as jest.Mock;

const handleLogoutMock = jest.fn().mockResolvedValue(undefined);

beforeEach(() => {
  jest.clearAllMocks();
  handleLogoutMock.mockClear();
  useCurrentUserMock.mockReturnValue({
    data: {
      id: 'u-1',
      nickname: '테스트유저',
      email: 'test@example.com',
      createdAt: '2026-03-15T10:00:00Z',
    },
  });
  useMyPhotosMock.mockReturnValue({ data: [{ id: 'p1' }, { id: 'p2' }] });
  useMyVotesMock.mockReturnValue({ data: [{ id: 'p3' }] });
  useLogoutMock.mockReturnValue({ handleLogout: handleLogoutMock, isPending: false });
});

describe('AuthenticatedProfile', () => {
  it('renders nickname and formatted join date', () => {
    const { getByText } = render(<AuthenticatedProfile />);
    expect(getByText('테스트유저')).toBeTruthy();
    expect(getByText('가입일: 2026.03.15')).toBeTruthy();
  });

  it('renders my-photos count from useMyPhotos', () => {
    const { getByTestId } = render(<AuthenticatedProfile />);
    expect(getByTestId('profile-menu-my-photos')).toHaveProp(
      'accessibilityLabel',
      '내가 올린 사진, 2장',
    );
  });

  it('renders my-votes count from useMyVotes', () => {
    const { getByTestId } = render(<AuthenticatedProfile />);
    expect(getByTestId('profile-menu-my-votes')).toHaveProp(
      'accessibilityLabel',
      '내가 추천한 사진, 1장',
    );
  });

  it('navigates to /my-photos when my-photos row is pressed', () => {
    const { getByTestId } = render(<AuthenticatedProfile />);
    fireEvent.press(getByTestId('profile-menu-my-photos'));
    expect(routerPushMock).toHaveBeenCalledWith('/my-photos');
  });

  it('navigates to /my-votes when my-votes row is pressed', () => {
    const { getByTestId } = render(<AuthenticatedProfile />);
    fireEvent.press(getByTestId('profile-menu-my-votes'));
    expect(routerPushMock).toHaveBeenCalledWith('/my-votes');
  });

  it('renders an account-settings menu row', () => {
    const { getByTestId } = render(<AuthenticatedProfile />);
    expect(getByTestId('profile-menu-account-settings')).toBeTruthy();
  });

  it('navigates to /account-settings when the row is pressed', () => {
    const { getByTestId } = render(<AuthenticatedProfile />);
    fireEvent.press(getByTestId('profile-menu-account-settings'));
    expect(routerPushMock).toHaveBeenCalledWith('/account-settings');
  });

  it('calls handleLogout when logout row is pressed', () => {
    const { getByTestId } = render(<AuthenticatedProfile />);
    fireEvent.press(getByTestId('profile-menu-logout'));
    expect(handleLogoutMock).toHaveBeenCalledTimes(1);
  });

  it('disables logout row while logout is pending', () => {
    useLogoutMock.mockReturnValue({ handleLogout: handleLogoutMock, isPending: true });
    const { getByTestId } = render(<AuthenticatedProfile />);
    expect(getByTestId('profile-menu-logout')).toHaveProp('accessibilityState', {
      disabled: true,
    });
  });

  it('shows zero count when photos data is undefined', () => {
    useMyPhotosMock.mockReturnValue({ data: undefined });
    const { getByTestId } = render(<AuthenticatedProfile />);
    expect(getByTestId('profile-menu-my-photos')).toHaveProp(
      'accessibilityLabel',
      '내가 올린 사진, 0장',
    );
  });

  it('omits join date when user has no createdAt', () => {
    useCurrentUserMock.mockReturnValue({
      data: { id: 'u-1', nickname: '익명유저', email: 'a@b.com' },
    });
    const { queryByText } = render(<AuthenticatedProfile />);
    expect(queryByText(/가입일:/)).toBeNull();
  });
});
