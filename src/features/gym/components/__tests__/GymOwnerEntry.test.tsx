import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';

import { GymOwnerEntry } from '../GymOwnerEntry';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const mockUseCurrentUser = jest.fn();
jest.mock('@/features/auth/hooks/useCurrentUser', () => ({
  useCurrentUser: () => mockUseCurrentUser() as unknown,
}));

const mockUseQueue = jest.fn();
jest.mock('@/shared/generated/owner/owner', () => ({
  useQueue: () => mockUseQueue() as unknown,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUseQueue.mockReturnValue({ data: undefined });
});

describe('GymOwnerEntry', () => {
  it('renders nothing for anonymous users', () => {
    mockUseCurrentUser.mockReturnValue({ data: undefined });
    const { queryByTestId } = render(<GymOwnerEntry gymId="g-1" gymName="테스트짐" />);
    expect(queryByTestId('gym-claim-button')).toBeNull();
    expect(queryByTestId('gym-owner-tools-button')).toBeNull();
  });

  it('shows the claim button for a regular user', () => {
    mockUseCurrentUser.mockReturnValue({ data: { id: 'u', role: 'user' } });
    const { getByTestId } = render(<GymOwnerEntry gymId="g-1" gymName="테스트짐" />);
    expect(getByTestId('gym-claim-button')).toBeTruthy();
  });

  it('shows the owner-tools button when the user owns this gym (queue contains it)', () => {
    mockUseCurrentUser.mockReturnValue({ data: { id: 'u', role: 'owner' } });
    mockUseQueue.mockReturnValue({ data: { data: [{ gymId: 'g-1' }] } });
    const { getByTestId } = render(<GymOwnerEntry gymId="g-1" gymName="테스트짐" />);
    expect(getByTestId('gym-owner-tools-button')).toBeTruthy();
  });

  it('falls back to claim button for owner of a different gym', () => {
    mockUseCurrentUser.mockReturnValue({ data: { id: 'u', role: 'owner' } });
    mockUseQueue.mockReturnValue({ data: { data: [{ gymId: 'g-other' }] } });
    const { getByTestId } = render(<GymOwnerEntry gymId="g-1" gymName="테스트짐" />);
    expect(getByTestId('gym-claim-button')).toBeTruthy();
  });

  it('routes to claim with gymId + gymName params on tap', () => {
    mockUseCurrentUser.mockReturnValue({ data: { id: 'u', role: 'user' } });
    const { getByTestId } = render(<GymOwnerEntry gymId="g-1" gymName="테스트짐" />);
    fireEvent.press(getByTestId('gym-claim-button'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/owner/claim',
      params: { gymId: 'g-1', gymName: '테스트짐' },
    });
  });

  it('routes to owner machines on owner-tools tap', () => {
    mockUseCurrentUser.mockReturnValue({ data: { id: 'u', role: 'owner' } });
    mockUseQueue.mockReturnValue({ data: { data: [{ gymId: 'g-1' }] } });
    const { getByTestId } = render(<GymOwnerEntry gymId="g-1" gymName="테스트짐" />);
    fireEvent.press(getByTestId('gym-owner-tools-button'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/owner/machines/[gym]',
      params: { gym: 'g-1' },
    });
  });
});
