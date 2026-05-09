import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { useGymMachines } from '@/features/gym/hooks/useGymMachines';
import { useGymSearch } from '@/features/map/hooks/useGymSearch';
import { useCurrentLocation } from '@/shared/hooks/useCurrentLocation';
import type { GymMachineWithDetails, GymWithMachineCount } from '@/shared/types/database';
import { createQueryWrapper } from '@/test/utils/query-wrapper';

import { UploadGymSelectScreen } from '../UploadGymSelectScreen';

jest.mock('@/features/map/hooks/useGymSearch', () => ({
  useGymSearch: jest.fn(),
}));

jest.mock('@/shared/hooks/useCurrentLocation', () => ({
  useCurrentLocation: jest.fn(),
}));

jest.mock('@/features/gym/hooks/useGymMachines', () => ({
  useGymMachines: jest.fn(),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockUseGymSearch = useGymSearch as jest.MockedFunction<typeof useGymSearch>;
const mockUseGymMachines = useGymMachines as jest.MockedFunction<typeof useGymMachines>;
const mockUseCurrentLocation = useCurrentLocation as jest.MockedFunction<typeof useCurrentLocation>;

const SAMPLE_GYMS: GymWithMachineCount[] = [
  {
    id: 'gym-1',
    name: '강남 피트니스',
    address: '서울 강남구 테헤란로 1',
    latitude: 37.4979,
    longitude: 127.0276,
    phone: null,
    operating_hours: null,
    day_pass_price: null,
    is_verified: true,
    last_verified_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    machine_count: 5,
  },
  {
    id: 'gym-2',
    name: '역삼 헬스클럽',
    address: '서울 강남구 역삼로 2',
    latitude: 37.4989,
    longitude: 127.0286,
    phone: null,
    operating_hours: null,
    day_pass_price: null,
    is_verified: false,
    last_verified_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    machine_count: 3,
  },
];

const SAMPLE_MACHINES: GymMachineWithDetails[] = [
  {
    id: 'machine-1',
    gym_id: 'gym-1',
    template_id: 'tpl-1',
    quantity: 1,
    is_custom: false,
    custom_name: null,
    last_verified_at: null,
    created_at: '2026-01-01T00:00:00Z',
    template: {
      id: 'tpl-1',
      brand_id: 'brand-1',
      category_id: 'cat-1',
      name: '벤치 프레스',
      loading_type: 'plate',
      is_approved: true,
      created_at: '2026-01-01T00:00:00Z',
      brand: { id: 'brand-1', name: 'Life Fitness' },
      category: { id: 'cat-1', name: '가슴' },
    },
    photos: [],
  },
  {
    id: 'machine-2',
    gym_id: 'gym-1',
    template_id: 'tpl-2',
    quantity: 2,
    is_custom: false,
    custom_name: null,
    last_verified_at: null,
    created_at: '2026-01-01T00:00:00Z',
    template: {
      id: 'tpl-2',
      brand_id: 'brand-1',
      category_id: 'cat-2',
      name: '레그 프레스',
      loading_type: 'plate',
      is_approved: true,
      created_at: '2026-01-01T00:00:00Z',
      brand: { id: 'brand-1', name: 'Life Fitness' },
      category: { id: 'cat-2', name: '하체' },
    },
    photos: [],
  },
];

function makeUseQueryResult(
  overrides: Partial<ReturnType<typeof useGymSearch>>,
): ReturnType<typeof useGymSearch> {
  return {
    data: undefined,
    isPending: false,
    isError: false,
    isSuccess: false,
    isLoading: false,
    isFetching: false,
    isStale: false,
    isPlaceholderData: false,
    isFetchedAfterMount: false,
    isFetched: false,
    isRefetching: false,
    isLoadingError: false,
    isRefetchError: false,
    dataUpdatedAt: 0,
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null,
    error: null,
    errorUpdateCount: 0,
    status: 'pending',
    fetchStatus: 'idle',
    refetch: jest.fn(),
    promise: Promise.resolve(undefined as unknown as GymWithMachineCount[]),
    ...overrides,
  } as ReturnType<typeof useGymSearch>;
}

function makeGymMachinesResult(
  overrides: Partial<ReturnType<typeof useGymMachines>>,
): ReturnType<typeof useGymMachines> {
  return {
    data: undefined,
    isPending: false,
    isError: false,
    isSuccess: false,
    isLoading: false,
    isFetching: false,
    isStale: false,
    isPlaceholderData: false,
    isFetchedAfterMount: false,
    isFetched: false,
    isRefetching: false,
    isLoadingError: false,
    isRefetchError: false,
    dataUpdatedAt: 0,
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null,
    error: null,
    errorUpdateCount: 0,
    status: 'pending',
    fetchStatus: 'idle',
    refetch: jest.fn(),
    promise: Promise.resolve(undefined as unknown as GymMachineWithDetails[]),
    ...overrides,
  } as ReturnType<typeof useGymMachines>;
}

describe('UploadGymSelectScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseGymMachines.mockReturnValue(makeGymMachinesResult({ isPending: true }));
  });

  function renderScreen() {
    const { Wrapper } = createQueryWrapper();
    return render(<UploadGymSelectScreen />, { wrapper: Wrapper });
  }

  it('renders loading state when location is loading', () => {
    mockUseCurrentLocation.mockReturnValue({ status: 'loading' });
    mockUseGymSearch.mockReturnValue(makeUseQueryResult({ isPending: true }));

    const { getByTestId } = renderScreen();

    expect(getByTestId('location-loading')).toBeTruthy();
  });

  it('renders gym list when location and gym data are available', async () => {
    mockUseCurrentLocation.mockReturnValue({
      status: 'ready',
      location: { latitude: 37.4979, longitude: 127.0276 },
    });
    mockUseGymSearch.mockReturnValue(
      makeUseQueryResult({
        isPending: false,
        isSuccess: true,
        data: SAMPLE_GYMS,
        status: 'success',
      }),
    );

    const { getByTestId } = renderScreen();

    await waitFor(() => {
      expect(getByTestId('gym-item-gym-1')).toBeTruthy();
      expect(getByTestId('gym-item-gym-2')).toBeTruthy();
    });
  });

  it('tapping a gym shows its machines', async () => {
    mockUseCurrentLocation.mockReturnValue({
      status: 'ready',
      location: { latitude: 37.4979, longitude: 127.0276 },
    });
    mockUseGymSearch.mockReturnValue(
      makeUseQueryResult({
        isPending: false,
        isSuccess: true,
        data: SAMPLE_GYMS,
        status: 'success',
      }),
    );
    mockUseGymMachines.mockReturnValue(
      makeGymMachinesResult({
        isPending: false,
        isSuccess: true,
        data: SAMPLE_MACHINES,
        status: 'success',
      }),
    );

    const { getByTestId } = renderScreen();

    await waitFor(() => {
      expect(getByTestId('gym-item-gym-1')).toBeTruthy();
    });

    fireEvent.press(getByTestId('gym-item-gym-1'));

    await waitFor(() => {
      expect(getByTestId('machine-item-machine-1')).toBeTruthy();
      expect(getByTestId('machine-item-machine-2')).toBeTruthy();
    });
  });

  it('tapping a machine calls router.push with correct gymMachineId', async () => {
    mockUseCurrentLocation.mockReturnValue({
      status: 'ready',
      location: { latitude: 37.4979, longitude: 127.0276 },
    });
    mockUseGymSearch.mockReturnValue(
      makeUseQueryResult({
        isPending: false,
        isSuccess: true,
        data: SAMPLE_GYMS,
        status: 'success',
      }),
    );
    mockUseGymMachines.mockReturnValue(
      makeGymMachinesResult({
        isPending: false,
        isSuccess: true,
        data: SAMPLE_MACHINES,
        status: 'success',
      }),
    );

    const { getByTestId } = renderScreen();

    await waitFor(() => {
      expect(getByTestId('gym-item-gym-1')).toBeTruthy();
    });

    fireEvent.press(getByTestId('gym-item-gym-1'));

    await waitFor(() => {
      expect(getByTestId('machine-item-machine-1')).toBeTruthy();
    });

    fireEvent.press(getByTestId('machine-item-machine-1'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(upload)/photo',
      params: { gymMachineId: 'machine-1' },
    });
  });

  it('renders the "헬스장이 없어요?" button', () => {
    mockUseCurrentLocation.mockReturnValue({
      status: 'ready',
      location: { latitude: 37.4979, longitude: 127.0276 },
    });
    mockUseGymSearch.mockReturnValue(
      makeUseQueryResult({
        isPending: false,
        isSuccess: true,
        data: SAMPLE_GYMS,
        status: 'success',
      }),
    );

    const { getByTestId } = renderScreen();

    expect(getByTestId('no-gym-button')).toBeTruthy();
  });

  it('renders gyms loading indicator while gym data is pending', () => {
    mockUseCurrentLocation.mockReturnValue({
      status: 'ready',
      location: { latitude: 37.4979, longitude: 127.0276 },
    });
    mockUseGymSearch.mockReturnValue(
      makeUseQueryResult({ isPending: true, status: 'pending', fetchStatus: 'fetching' }),
    );

    const { getByTestId } = renderScreen();

    expect(getByTestId('gyms-loading')).toBeTruthy();
  });

  it('renders empty state when no gyms found', () => {
    mockUseCurrentLocation.mockReturnValue({
      status: 'ready',
      location: { latitude: 37.4979, longitude: 127.0276 },
    });
    mockUseGymSearch.mockReturnValue(
      makeUseQueryResult({ isPending: false, isSuccess: true, data: [], status: 'success' }),
    );

    const { getByTestId } = renderScreen();

    expect(getByTestId('no-gyms-empty')).toBeTruthy();
  });

  it('filters gym list when search text is typed', async () => {
    mockUseCurrentLocation.mockReturnValue({
      status: 'ready',
      location: { latitude: 37.4979, longitude: 127.0276 },
    });
    mockUseGymSearch.mockReturnValue(
      makeUseQueryResult({
        isPending: false,
        isSuccess: true,
        data: SAMPLE_GYMS,
        status: 'success',
      }),
    );

    const { getByTestId, getByPlaceholderText, queryByTestId } = renderScreen();

    await waitFor(() => {
      expect(getByTestId('gym-item-gym-1')).toBeTruthy();
      expect(getByTestId('gym-item-gym-2')).toBeTruthy();
    });

    fireEvent.changeText(getByPlaceholderText('헬스장 이름 검색'), '강남');

    await waitFor(() => {
      expect(getByTestId('gym-item-gym-1')).toBeTruthy();
      expect(queryByTestId('gym-item-gym-2')).toBeNull();
    });
  });

  it('renders gym list when location is in fallback state', async () => {
    mockUseCurrentLocation.mockReturnValue({
      status: 'fallback',
      location: { latitude: 37.4979, longitude: 127.0276 },
      reason: 'permission_denied',
    });
    mockUseGymSearch.mockReturnValue(
      makeUseQueryResult({
        isPending: false,
        isSuccess: true,
        data: SAMPLE_GYMS,
        status: 'success',
      }),
    );

    const { getByTestId } = renderScreen();

    await waitFor(() => {
      expect(getByTestId('gym-item-gym-1')).toBeTruthy();
    });
  });
});
