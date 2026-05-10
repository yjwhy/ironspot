import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import type * as ReactNative from 'react-native';

import type { MachinePhoto } from '@/shared/types/database';
import { makeMachinePhoto } from '@/test/utils/factories/gym-machine';

import { useMachinePhotos } from '../../hooks/useMachinePhotos';
import { useUpvote } from '../../hooks/useUpvote';
import { PhotoDetailScreen } from '../PhotoDetailScreen';

jest.mock('react-native-reanimated', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mock = require('react-native-reanimated/mock') as Record<string, unknown>;
  return { ...mock };
});

jest.mock('../../hooks/useMachinePhotos', () => ({
  useMachinePhotos: jest.fn(),
}));

jest.mock('../../hooks/useUpvote', () => ({
  useUpvote: jest.fn(),
}));

jest.mock('@/features/auth/hooks/useRequireAuth', () => ({
  useRequireAuth: () => (cb: () => void) => {
    cb();
  },
}));

jest.mock('../ReportReasonSheet', () => ({
  ReportReasonSheet: jest.fn(({ photoId }: { photoId: string; onClose: () => void }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const RN = require('react-native') as typeof ReactNative;
    return <RN.View testID={`report-sheet-${photoId}`} />;
  }),
}));

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const photoOne: MachinePhoto = makeMachinePhoto({
  id: 'p1',
  gym_machine_id: 'gm-1',
  upvote_count: 12,
  created_at: '2026-03-01T00:00:00Z',
  user_id: null,
});

const photoTwo: MachinePhoto = makeMachinePhoto({
  id: 'p2',
  gym_machine_id: 'gm-1',
  upvote_count: 3,
  created_at: '2026-02-15T00:00:00Z',
  user_id: 'user-1',
});

interface QueryStub {
  data?: readonly MachinePhoto[];
  isPending?: boolean;
  isError?: boolean;
  error?: Error | null;
}

function setMachinePhotos(stub: QueryStub = {}): void {
  (useMachinePhotos as jest.Mock).mockReturnValue({
    data: 'data' in stub ? stub.data : [photoOne, photoTwo],
    isPending: stub.isPending ?? false,
    isError: stub.isError ?? false,
    isFetching: false,
    error: stub.error ?? null,
    refetch: jest.fn(),
  });
}

function setUpvote({
  handleUpvote = jest.fn(),
  isPending = false,
  isUpvotedByMe = false,
}: {
  handleUpvote?: jest.Mock;
  isPending?: boolean;
  isUpvotedByMe?: boolean;
} = {}): jest.Mock {
  (useUpvote as jest.Mock).mockReturnValue({ handleUpvote, isPending, isUpvotedByMe });
  return handleUpvote;
}

describe('PhotoDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setMachinePhotos();
    setUpvote();
  });

  it('renders the upvote count and creation date of the initial photo in the footer', () => {
    const { getByText } = render(<PhotoDetailScreen photoId="p1" machineId="gm-1" />);
    expect(getByText('추천 12')).toBeTruthy();
    expect(getByText('2026.03.01')).toBeTruthy();
  });

  it('renders "익명" as uploader when user_id is null', () => {
    const { getByText } = render(<PhotoDetailScreen photoId="p1" machineId="gm-1" />);
    expect(getByText('익명')).toBeTruthy();
  });

  it('exposes a close button that calls router.back when tapped', () => {
    const { getByLabelText } = render(<PhotoDetailScreen photoId="p1" machineId="gm-1" />);
    fireEvent.press(getByLabelText('닫기'));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('renders an active report button when a photo is in view', () => {
    const { getByRole } = render(<PhotoDetailScreen photoId="p1" machineId="gm-1" />);
    expect(getByRole('button', { name: '신고하기' })).toBeTruthy();
  });

  it('renders the report button as disabled while photos are loading', () => {
    setMachinePhotos({ isPending: true, data: undefined });
    const { getByRole } = render(<PhotoDetailScreen photoId="p1" machineId="gm-1" />);
    expect(getByRole('button', { name: '신고하기', disabled: true })).toBeTruthy();
  });

  it('opens the report sheet for the current photo when the report button is tapped', () => {
    const { getByLabelText, queryByTestId, getByTestId } = render(
      <PhotoDetailScreen photoId="p1" machineId="gm-1" />,
    );
    expect(queryByTestId('report-sheet-p1')).toBeNull();
    fireEvent.press(getByLabelText('신고하기'));
    expect(getByTestId('report-sheet-p1')).toBeTruthy();
  });

  it('renders an error EmptyState when the photo query errors', () => {
    setMachinePhotos({ isError: true, error: new Error('boom'), data: undefined });
    const { getByText } = render(<PhotoDetailScreen photoId="p1" machineId="gm-1" />);
    expect(getByText('사진을 불러올 수 없어요')).toBeTruthy();
  });

  it('renders an error EmptyState when the requested photo is not in the array', () => {
    setMachinePhotos({ data: [photoOne] });
    const { getByText } = render(<PhotoDetailScreen photoId="missing" machineId="gm-1" />);
    expect(getByText('사진을 불러올 수 없어요')).toBeTruthy();
  });

  it('renders an error EmptyState when machineId is missing', () => {
    const { getByText } = render(<PhotoDetailScreen photoId="p1" machineId={undefined} />);
    expect(getByText('사진을 불러올 수 없어요')).toBeTruthy();
  });

  it('does not render the footer while photos are pending', () => {
    setMachinePhotos({ isPending: true, data: undefined });
    const { queryByText } = render(<PhotoDetailScreen photoId="p1" machineId="gm-1" />);
    expect(queryByText('추천 12')).toBeNull();
  });

  it('keeps the close button tappable in the error state so the user can exit', () => {
    setMachinePhotos({ isError: true, error: new Error('boom'), data: undefined });
    const { getByLabelText } = render(<PhotoDetailScreen photoId="p1" machineId="gm-1" />);
    fireEvent.press(getByLabelText('닫기'));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('pressing the upvote button calls handleUpvote', () => {
    const handleUpvote = setUpvote();
    const { getByLabelText } = render(<PhotoDetailScreen photoId="p1" machineId="gm-1" />);
    fireEvent.press(getByLabelText('추천 12'));
    expect(handleUpvote).toHaveBeenCalledTimes(1);
  });

  it('upvote button shows "추천 취소" label when already voted', () => {
    setUpvote({ isUpvotedByMe: true });
    const { getByLabelText } = render(<PhotoDetailScreen photoId="p1" machineId="gm-1" />);
    expect(getByLabelText('추천 취소')).toBeTruthy();
  });

  it('upvote button is disabled when isPending is true', () => {
    setUpvote({ isPending: true });
    const { getByRole } = render(<PhotoDetailScreen photoId="p1" machineId="gm-1" />);
    expect(getByRole('button', { name: '추천 12', disabled: true })).toBeTruthy();
  });
});
