import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { MyReportsScreen } from '../MyReportsScreen';

const mockUseListMine = jest.fn();
const mockEscalateMutateAsync = jest.fn();
const mockUseEscalate = jest.fn();
const mockInvalidate = jest.fn();
jest.mock('@/shared/generated/reports/reports', () => ({
  useListMine: () => mockUseListMine() as unknown,
  useEscalate: () => mockUseEscalate() as unknown,
  getListMineQueryKey: jest.fn(() => ['mine']),
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
}));

jest.mock('burnt', () => ({ toast: jest.fn() }));
jest.mock('@/shared/lib/sentry', () => ({ captureError: jest.fn() }));

function getBurntMock() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('burnt') as { toast: jest.Mock };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseEscalate.mockReturnValue({
    mutateAsync: mockEscalateMutateAsync,
    isPending: false,
  });
});

describe('MyReportsScreen', () => {
  it('renders an empty state when the user has filed no reports', () => {
    mockUseListMine.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { data: [] },
    });
    const { getByText } = render(<MyReportsScreen />);
    expect(getByText('신고한 내역이 없어요')).toBeTruthy();
  });

  it('renders an error state when the query fails', () => {
    mockUseListMine.mockReturnValue({ isLoading: false, isError: true, data: undefined });
    const { getByText } = render(<MyReportsScreen />);
    expect(getByText('신고 내역을 불러올 수 없어요')).toBeTruthy();
  });

  it('hides the escalate button for pending reports', () => {
    mockUseListMine.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        data: [
          {
            id: 'r1',
            targetType: 'photo',
            targetId: 't1',
            reason: 'INAPPROPRIATE',
            status: 'pending',
            createdAt: '2026-05-18T00:00:00Z',
            escalated: false,
          },
        ],
      },
    });
    const { queryByTestId } = render(<MyReportsScreen />);
    expect(queryByTestId('my-report-r1-escalate')).toBeNull();
  });

  it('shows the escalate button for actioned reports', () => {
    mockUseListMine.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        data: [
          {
            id: 'r2',
            targetType: 'photo',
            targetId: 't1',
            reason: 'INAPPROPRIATE',
            status: 'actioned',
            createdAt: '2026-05-18T00:00:00Z',
            escalated: false,
          },
        ],
      },
    });
    const { getByTestId } = render(<MyReportsScreen />);
    expect(getByTestId('my-report-r2-escalate')).toBeTruthy();
  });

  it('hides the escalate button when already escalated', () => {
    mockUseListMine.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        data: [
          {
            id: 'r3',
            targetType: 'photo',
            targetId: 't1',
            reason: 'OTHER',
            status: 'actioned',
            createdAt: '2026-05-18T00:00:00Z',
            escalated: true,
          },
        ],
      },
    });
    const { queryByTestId, getByText } = render(<MyReportsScreen />);
    expect(queryByTestId('my-report-r3-escalate')).toBeNull();
    expect(getByText('이의제기됨 · admin 재검토 대기')).toBeTruthy();
  });

  it('calls escalate mutation + shows success toast on tap', async () => {
    mockUseListMine.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        data: [
          {
            id: 'r4',
            targetType: 'photo',
            targetId: 't1',
            reason: 'INAPPROPRIATE',
            status: 'dismissed',
            createdAt: '2026-05-18T00:00:00Z',
            escalated: false,
          },
        ],
      },
    });
    mockEscalateMutateAsync.mockResolvedValue(undefined);

    const { getByTestId } = render(<MyReportsScreen />);
    fireEvent.press(getByTestId('my-report-r4-escalate'));

    await waitFor(() => {
      expect(mockEscalateMutateAsync).toHaveBeenCalledWith({ id: 'r4' });
    });
    await waitFor(() => {
      expect(getBurntMock().toast).toHaveBeenCalledWith({
        title: '이의제기를 접수했어요',
        preset: 'done',
      });
    });
    expect(mockInvalidate).toHaveBeenCalled();
  });

  it('shows error toast when escalate mutation fails', async () => {
    mockUseListMine.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        data: [
          {
            id: 'r5',
            targetType: 'photo',
            targetId: 't1',
            reason: 'INAPPROPRIATE',
            status: 'dismissed',
            createdAt: '2026-05-18T00:00:00Z',
            escalated: false,
          },
        ],
      },
    });
    mockEscalateMutateAsync.mockRejectedValue(new Error('conflict'));

    const { getByTestId } = render(<MyReportsScreen />);
    fireEvent.press(getByTestId('my-report-r5-escalate'));

    await waitFor(() => {
      expect(getBurntMock().toast).toHaveBeenCalledWith({
        title: '이의제기에 실패했어요',
        preset: 'error',
      });
    });
  });
});
