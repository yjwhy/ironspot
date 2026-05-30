import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';

import type { PhotoResponse } from '@/shared/generated/model/photoResponse';

import { MyPhotoListView } from '../MyPhotoListView';

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
}));

const routerPushMock = router.push as jest.Mock;
const routerBackMock = router.back as jest.Mock;
const routerReplaceMock = router.replace as jest.Mock;
const routerCanGoBackMock = router.canGoBack as jest.Mock;

function makePhoto(overrides: Partial<PhotoResponse> = {}): PhotoResponse {
  return {
    id: 'photo-1',
    gymMachineId: 'machine-1',
    userId: 'user-1',
    photoUrl: 'https://example.com/p.jpg',
    contentPath: '/api/photos/photo-1/content',
    upvoteCount: 5,
    createdAt: '2026-04-01T00:00:00Z',
    ...overrides,
  };
}

const baseProps = {
  title: '내가 올린 사진',
  emptyTitle: '아직 올린 사진이 없어요',
  emptyDescription: '머신 사진을 올려보세요!',
  isPending: false,
  isError: false,
  isFetching: false,
  onRefresh: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('MyPhotoListView', () => {
  it('renders the title in a header', () => {
    const { getByRole } = render(<MyPhotoListView {...baseProps} photos={[]} />);
    expect(getByRole('header', { name: '내가 올린 사진' })).toBeTruthy();
  });

  it('navigates back when the back button is pressed and there is history', () => {
    routerCanGoBackMock.mockReturnValue(true);
    const { getByRole } = render(<MyPhotoListView {...baseProps} photos={[]} />);
    fireEvent.press(getByRole('button', { name: '뒤로 가기' }));
    expect(routerBackMock).toHaveBeenCalledTimes(1);
    expect(routerReplaceMock).not.toHaveBeenCalled();
  });

  it('falls back to the profile tab when there is no history (no GO_BACK trap)', () => {
    routerCanGoBackMock.mockReturnValue(false);
    const { getByRole } = render(<MyPhotoListView {...baseProps} photos={[]} />);
    fireEvent.press(getByRole('button', { name: '뒤로 가기' }));
    expect(routerBackMock).not.toHaveBeenCalled();
    expect(routerReplaceMock).toHaveBeenCalledWith('/(tabs)/profile');
  });

  it('shows empty state when there are no photos', () => {
    const { getByText } = render(<MyPhotoListView {...baseProps} photos={[]} />);
    expect(getByText('아직 올린 사진이 없어요')).toBeTruthy();
    expect(getByText('머신 사진을 올려보세요!')).toBeTruthy();
  });

  it('shows error state when isError is true', () => {
    const { getByText } = render(<MyPhotoListView {...baseProps} photos={undefined} isError />);
    expect(getByText('사진을 불러올 수 없어요')).toBeTruthy();
  });

  it('renders a cell per photo and navigates to the photo detail on press', () => {
    const photoA = makePhoto({ id: 'photo-A', gymMachineId: 'machine-A' });
    const photoB = makePhoto({ id: 'photo-B', gymMachineId: 'machine-B' });
    const { getByTestId } = render(<MyPhotoListView {...baseProps} photos={[photoA, photoB]} />);
    expect(getByTestId('my-photo-cell-photo-A')).toBeTruthy();
    expect(getByTestId('my-photo-cell-photo-B')).toBeTruthy();

    fireEvent.press(getByTestId('my-photo-cell-photo-B'));
    expect(routerPushMock).toHaveBeenCalledWith({
      pathname: '/photo/[id]',
      params: { id: 'photo-B', machineId: 'machine-B' },
    });
  });

  it('renders the gym and machine caption on a cell when present', () => {
    const photo = makePhoto({
      id: 'photo-C',
      gymMachineId: 'machine-C',
      machineName: '하이로우',
      gymName: '테스트 헬스장',
    });
    const { getByText } = render(<MyPhotoListView {...baseProps} photos={[photo]} />);
    expect(getByText('하이로우')).toBeTruthy();
    expect(getByText('테스트 헬스장')).toBeTruthy();
  });
});
