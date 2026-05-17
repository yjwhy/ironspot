import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';

import { OwnerActivityWidget } from '../OwnerActivityWidget';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const mockUseQueue = jest.fn();
jest.mock('@/shared/generated/owner/owner', () => ({
  useQueue: () => mockUseQueue() as unknown,
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('OwnerActivityWidget', () => {
  it('renders the empty state caption when no pending items', () => {
    mockUseQueue.mockReturnValue({ data: { data: [] } });
    const { getByText } = render(<OwnerActivityWidget />);
    expect(getByText('처리할 작업이 없어요')).toBeTruthy();
  });

  it('renders the pending caption when at least one report waits', () => {
    mockUseQueue.mockReturnValue({
      data: { data: [{ reportId: 'r1', gymId: 'g1' } as unknown as { reportId: string }] },
    });
    const { getByText } = render(<OwnerActivityWidget />);
    expect(getByText('처리 대기 중인 신고가 있어요')).toBeTruthy();
  });

  it('routes to the owner home when pressed', () => {
    mockUseQueue.mockReturnValue({ data: { data: [] } });
    const { getByTestId } = render(<OwnerActivityWidget />);
    fireEvent.press(getByTestId('owner-activity-widget'));
    expect(router.push).toHaveBeenCalledWith('/owner');
  });
});
