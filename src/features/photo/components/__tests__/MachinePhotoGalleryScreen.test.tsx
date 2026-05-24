import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';

import { useRequireAuth } from '@/features/auth/hooks/useRequireAuth';
import { useGymDetail } from '@/features/gym/hooks/useGymDetail';
import { useGymMachines } from '@/features/gym/hooks/useGymMachines';
import { UPLOAD_PHOTO_PATHNAME } from '@/features/upload/constants';
import type { Gym, GymMachineWithDetails, MachinePhoto } from '@/shared/types/database';
import { makeGymMachineWithDetails, makeMachinePhoto } from '@/test/utils/factories/gym-machine';

import { useMachinePhotos } from '../../hooks/useMachinePhotos';
import { MachinePhotoGalleryScreen } from '../MachinePhotoGalleryScreen';

jest.mock('@/features/auth/hooks/useRequireAuth', () => ({
  useRequireAuth: jest.fn(),
}));
jest.mock('@/features/gym/hooks/useGymDetail', () => ({
  useGymDetail: jest.fn(),
}));
jest.mock('@/features/gym/hooks/useGymMachines', () => ({
  useGymMachines: jest.fn(),
}));
jest.mock('../../hooks/useMachinePhotos', () => ({
  useMachinePhotos: jest.fn(),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const sampleGym: Gym = {
  id: 'g-1',
  name: 'Fitness Factory',
  address: '서울 강남구',
  latitude: 37.5,
  longitude: 127.03,
  phone: null,
  operating_hours: null,
  day_pass_price: null,
  is_verified: true,
  last_verified_at: '2026-03-15T10:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  cover_photo_url: null,
};

const sampleMachine: GymMachineWithDetails = makeGymMachineWithDetails({
  machine: { id: 'gm-1', gym_id: 'g-1' },
  template: { name_en: 'High Row', name_ko: 'High Row' },
});

const samplePhoto: MachinePhoto = makeMachinePhoto({
  id: 'photo-1',
  gym_machine_id: 'gm-1',
  upvote_count: 12,
  created_at: '2026-03-01T00:00:00Z',
});

interface QueryStub<T> {
  data?: T;
  isPending?: boolean;
  isError?: boolean;
  isFetching?: boolean;
  error?: Error | null;
}

function buildStub<T>(stub: QueryStub<T>, defaultData: T): Record<string, unknown> {
  return {
    data: 'data' in stub ? stub.data : defaultData,
    isPending: stub.isPending ?? false,
    isError: stub.isError ?? false,
    isFetching: stub.isFetching ?? false,
    error: stub.error ?? null,
    refetch: jest.fn(),
  };
}

function setGymDetail(stub: QueryStub<Gym | null> = {}): void {
  (useGymDetail as jest.Mock).mockReturnValue(buildStub(stub, sampleGym));
}

function setGymMachines(stub: QueryStub<readonly GymMachineWithDetails[]> = {}): void {
  (useGymMachines as jest.Mock).mockReturnValue(buildStub(stub, [sampleMachine]));
}

function setMachinePhotos(stub: QueryStub<readonly MachinePhoto[]> = {}): void {
  (useMachinePhotos as jest.Mock).mockReturnValue(buildStub(stub, [samplePhoto]));
}

describe('MachinePhotoGalleryScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRequireAuth as jest.Mock).mockReturnValue((action: () => void) => {
      action();
    });
    setGymDetail();
    setGymMachines();
    setMachinePhotos();
  });

  it('renders the gym name and machine name in the header', () => {
    const { getByRole, getByText } = render(
      <MachinePhotoGalleryScreen gymId="g-1" machineId="gm-1" />,
    );
    expect(getByRole('header', { name: 'High Row' })).toBeTruthy();
    expect(getByText('Fitness Factory')).toBeTruthy();
  });

  it('renders skeleton placeholders while photos are pending', () => {
    setMachinePhotos({ isPending: true, data: undefined });
    const { getAllByLabelText } = render(
      <MachinePhotoGalleryScreen gymId="g-1" machineId="gm-1" />,
    );
    expect(getAllByLabelText('로딩 중').length).toBeGreaterThan(0);
  });

  it('renders an error EmptyState when the photo query errors', () => {
    setMachinePhotos({ isError: true, error: new Error('boom'), data: undefined });
    const { getByText } = render(<MachinePhotoGalleryScreen gymId="g-1" machineId="gm-1" />);
    expect(getByText('사진을 불러올 수 없어요')).toBeTruthy();
  });

  it('renders an empty EmptyState when the photo array is empty', () => {
    setMachinePhotos({ data: [] });
    const { getByText } = render(<MachinePhotoGalleryScreen gymId="g-1" machineId="gm-1" />);
    expect(getByText('아직 사진이 없어요')).toBeTruthy();
  });

  it('renders the PhotoGrid Best Cut when photos are loaded', () => {
    const { getByTestId } = render(<MachinePhotoGalleryScreen gymId="g-1" machineId="gm-1" />);
    expect(getByTestId('photo-grid-best-cut')).toBeTruthy();
  });

  it('navigates straight to the camera pre-bound to this gym+machine when the FAB is tapped by an authenticated user', () => {
    // Phase 5 item 15b: skip the redundant gym-select step — both gym and
    // machine are already known on this screen, so the camera should land
    // pre-bound via gymMachineId. Carrying gymId too lets UploadConfirmScreen
    // fall back to the gymId-only contribution path if OCR / template match
    // diverges from the current machine (e.g. wrong gym_machines row), so a
    // new contribution row gets bound to the right gym instead of orphaned.
    const { getByLabelText } = render(<MachinePhotoGalleryScreen gymId="g-1" machineId="gm-1" />);
    fireEvent.press(getByLabelText('사진 올리기'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: UPLOAD_PHOTO_PATHNAME,
      params: { gymId: 'g-1', gymMachineId: 'gm-1' },
    });
  });

  it('does not navigate to the camera when machineId is undefined (defensive)', () => {
    const { getByLabelText } = render(
      <MachinePhotoGalleryScreen gymId="g-1" machineId={undefined} />,
    );
    fireEvent.press(getByLabelText('사진 올리기'));
    expect(router.push).not.toHaveBeenCalled();
  });

  it('does not navigate to the camera when gymId is undefined (defensive — gym+machine guard is symmetric)', () => {
    // The function comment treats gym+machine as a pair, so the guard must
    // reject either half being undefined. Asymmetric guarding (machineId only)
    // would let `{ gymId: undefined, gymMachineId: 'gm-1' }` reach the camera
    // and silently lose the gymId-fallback contribution path.
    const { getByLabelText } = render(
      <MachinePhotoGalleryScreen gymId={undefined} machineId="gm-1" />,
    );
    fireEvent.press(getByLabelText('사진 올리기'));
    expect(router.push).not.toHaveBeenCalled();
  });

  it('redirects to login when the FAB is tapped by an unauthenticated user', () => {
    (useRequireAuth as jest.Mock).mockReturnValue((_action: () => void) => {
      router.push('/(auth)/login');
    });
    const { getByLabelText } = render(<MachinePhotoGalleryScreen gymId="g-1" machineId="gm-1" />);
    fireEvent.press(getByLabelText('사진 올리기'));
    expect(router.push).toHaveBeenCalledWith('/(auth)/login');
  });

  it('navigates to the photo detail modal with id and machineId when a photo is tapped', () => {
    const { getByTestId } = render(<MachinePhotoGalleryScreen gymId="g-1" machineId="gm-1" />);
    fireEvent.press(getByTestId('photo-grid-best-cut'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/photo/[id]',
      params: { id: 'photo-1', machineId: 'gm-1' },
    });
  });

  it('falls back to a generic header title when machine details are not yet loaded', () => {
    setGymMachines({ data: [] });
    const { getByRole } = render(<MachinePhotoGalleryScreen gymId="g-1" machineId="gm-1" />);
    expect(getByRole('header', { name: '머신 사진' })).toBeTruthy();
  });

  it('omits the gym name line when gym detail has not arrived', () => {
    setGymDetail({ data: null });
    const { queryByText } = render(<MachinePhotoGalleryScreen gymId="g-1" machineId="gm-1" />);
    expect(queryByText('Fitness Factory')).toBeNull();
  });

  it('does not navigate when machineId is undefined (defensive)', () => {
    const { getByTestId } = render(<MachinePhotoGalleryScreen gymId="g-1" machineId={undefined} />);
    fireEvent.press(getByTestId('photo-grid-best-cut'));
    expect(router.push).not.toHaveBeenCalled();
  });
});
