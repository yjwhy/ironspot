import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import type * as RnModule from 'react-native';

import type * as BottomSheetMockModule from '@/test/utils/bottom-sheet-mock';

import { useAdminQueue } from '../../hooks/useAdminQueue';
import { AdminQueueScreen } from '../AdminQueueScreen';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('expo-image', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const rn = require('react-native') as typeof RnModule;
  return { Image: rn.View };
});
jest.mock('../../hooks/useAdminQueue', () => ({ useAdminQueue: jest.fn() }));
jest.mock('@shopify/flash-list', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mock = require('@/test/utils/bottom-sheet-mock') as typeof BottomSheetMockModule;
  return { FlashList: mock.BottomSheetListMock };
});

const useAdminQueueMock = useAdminQueue as jest.Mock;
const routerPushMock = router.push as jest.Mock;

function Wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('AdminQueueScreen', () => {
  it('renders one row per pending item from useAdminQueue (unified shape)', () => {
    useAdminQueueMock.mockReturnValue({
      data: [
        {
          type: 'photo',
          targetId: 'p1',
          label: '사진',
          imageUrl: 'https://x/1.jpg',
          pendingReportCount: 3,
          oldestReportAt: '2026-05-13T00:00:00Z',
          topReason: 'INAPPROPRIATE',
        },
        {
          type: 'gym_machine',
          targetId: 'g1',
          label: 'Panatta High Row',
          pendingReportCount: 1,
          oldestReportAt: '2026-05-13T01:00:00Z',
          topReason: 'WRONG_TEMPLATE',
        },
      ],
      isLoading: false,
      isError: false,
    });

    render(<AdminQueueScreen />, { wrapper: Wrapper });

    expect(screen.getByTestId('admin-queue-row-photo-p1')).toBeTruthy();
    expect(screen.getByTestId('admin-queue-row-gym_machine-g1')).toBeTruthy();
    expect(screen.getByText('사진 · 신고 3건')).toBeTruthy();
    expect(screen.getByText('Panatta High Row · 신고 1건')).toBeTruthy();
  });

  it('routes to the photo detail screen when a photo row is tapped', () => {
    useAdminQueueMock.mockReturnValue({
      data: [
        {
          type: 'photo',
          targetId: 'p1',
          label: '사진',
          imageUrl: 'https://x/1.jpg',
          pendingReportCount: 2,
          oldestReportAt: '2026-05-13T00:00:00Z',
          topReason: 'INAPPROPRIATE',
        },
      ],
      isLoading: false,
      isError: false,
    });

    render(<AdminQueueScreen />, { wrapper: Wrapper });
    fireEvent.press(screen.getByTestId('admin-queue-row-photo-p1'));

    expect(routerPushMock).toHaveBeenCalledWith('/admin/photo/p1');
  });

  it('routes to the gym_machine detail screen when a gym_machine row is tapped', () => {
    useAdminQueueMock.mockReturnValue({
      data: [
        {
          type: 'gym_machine',
          targetId: 'g1',
          label: 'Panatta High Row',
          pendingReportCount: 1,
          oldestReportAt: '2026-05-13T01:00:00Z',
          topReason: 'WRONG_TEMPLATE',
        },
      ],
      isLoading: false,
      isError: false,
    });

    render(<AdminQueueScreen />, { wrapper: Wrapper });
    fireEvent.press(screen.getByTestId('admin-queue-row-gym_machine-g1'));

    expect(routerPushMock).toHaveBeenCalledWith('/admin/gym-machine/g1');
  });

  it('shows the empty state when the queue is empty', () => {
    useAdminQueueMock.mockReturnValue({ data: [], isLoading: false, isError: false });

    render(<AdminQueueScreen />, { wrapper: Wrapper });

    expect(screen.getByText('처리 대기 신고 없음')).toBeTruthy();
  });
});
