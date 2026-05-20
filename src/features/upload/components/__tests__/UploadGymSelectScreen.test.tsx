import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { useGymMachines } from '@/features/gym/hooks/useGymMachines';
import { useGymSearch } from '@/features/map/hooks/useGymSearch';
import { useCurrentLocation } from '@/shared/hooks/useCurrentLocation';
import type { GymMachineWithDetails, GymWithMachineCount } from '@/shared/types/database';
import { createQueryWrapper } from '@/test/utils/query-wrapper';

import { UPLOAD_PHOTO_PATHNAME } from '../../constants';
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

jest.mock('burnt', () => ({ toast: jest.fn() }));

jest.mock('@/shared/generated/gyms/gyms', () => ({
  useSearchPlaces: jest.fn(),
  useCreateGym: jest.fn(),
}));

const mockPush = jest.fn();
const mockUseLocalSearchParams = jest.fn(() => ({}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => mockUseLocalSearchParams(),
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
    matched_machine_names: [],
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
    matched_machine_names: [],
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
      name_en: 'Bench Press',
      name_ko: '벤치 프레스',
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
      name_en: 'Leg Press',
      name_ko: '레그 프레스',
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

// eslint-disable-next-line @typescript-eslint/no-require-imports
const orvalGyms = require('@/shared/generated/gyms/gyms') as {
  useSearchPlaces: jest.Mock;
  useCreateGym: jest.Mock;
};

describe('UploadGymSelectScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseGymMachines.mockReturnValue(makeGymMachinesResult({ isPending: true }));
    orvalGyms.useSearchPlaces.mockReturnValue({
      data: undefined,
      isFetching: false,
      isError: false,
    });
    orvalGyms.useCreateGym.mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    });
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

  it('tapping a machine calls router.push with gymMachineId + gymId', async () => {
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
      pathname: UPLOAD_PHOTO_PATHNAME,
      params: { gymMachineId: 'machine-1', gymId: 'gym-1' },
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

  // ─── Naver gym registration flow ─────────────────────────────────────────

  function setupReadyLocation() {
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
  }

  it('enters Naver search mode when "헬스장이 없어요?" is tapped', async () => {
    setupReadyLocation();
    const { getByTestId, getByText } = renderScreen();

    fireEvent.press(getByTestId('no-gym-button'));

    await waitFor(() => {
      expect(getByText('새 헬스장 등록')).toBeTruthy();
      expect(getByTestId('naver-search-input')).toBeTruthy();
    });
  });

  it('returns to gym list when cancel is tapped', async () => {
    setupReadyLocation();
    const { getByTestId, queryByText } = renderScreen();

    fireEvent.press(getByTestId('no-gym-button'));
    await waitFor(() => {
      expect(getByTestId('cancel-add-gym')).toBeTruthy();
    });

    fireEvent.press(getByTestId('cancel-add-gym'));
    await waitFor(() => {
      expect(queryByText('새 헬스장 등록')).toBeNull();
      expect(getByTestId('no-gym-button')).toBeTruthy();
    });
  });

  it('shows minimum-length hint while query is too short', async () => {
    setupReadyLocation();
    const { getByTestId } = renderScreen();
    fireEvent.press(getByTestId('no-gym-button'));

    fireEvent.changeText(getByTestId('naver-search-input'), 'ㅎ');

    await waitFor(() => {
      expect(getByTestId('naver-search-hint')).toBeTruthy();
    });
  });

  it('shows empty state when query has no results', async () => {
    setupReadyLocation();
    orvalGyms.useSearchPlaces.mockReturnValue({
      data: { data: [], status: 200 },
      isFetching: false,
      isError: false,
    });
    const { getByTestId } = renderScreen();
    fireEvent.press(getByTestId('no-gym-button'));

    fireEvent.changeText(getByTestId('naver-search-input'), '없는헬스장');

    await waitFor(() => {
      expect(getByTestId('naver-search-empty')).toBeTruthy();
    });
  });

  it('renders Naver places and triggers create-gym on tap', async () => {
    setupReadyLocation();
    const place = {
      id: 'naver-12345',
      name: '에어짐 강남',
      address: '서울 강남구 1',
      roadAddress: '서울특별시 테헤란로 1',
      latitude: 37.4979,
      longitude: 127.0276,
      phone: '02-1111-2222',
      category: '스포츠시설>헬스장',
    };
    orvalGyms.useSearchPlaces.mockReturnValue({
      data: { data: [place], status: 200 },
      isFetching: false,
      isError: false,
    });
    const mutate = jest.fn();
    orvalGyms.useCreateGym.mockReturnValue({ mutate, isPending: false });

    const { getByTestId } = renderScreen();
    fireEvent.press(getByTestId('no-gym-button'));
    fireEvent.changeText(getByTestId('naver-search-input'), '에어짐');

    await waitFor(() => {
      expect(getByTestId('naver-place-naver-12345')).toBeTruthy();
    });

    fireEvent.press(getByTestId('naver-place-naver-12345'));

    expect(mutate).toHaveBeenCalledWith({
      data: {
        name: '에어짐 강남',
        address: '서울특별시 테헤란로 1',
        latitude: 37.4979,
        longitude: 127.0276,
        naverPlaceId: 'naver-12345',
        phone: '02-1111-2222',
      },
    });
  });

  // ─── Phase 5 items 14 + 15a: selectedGymId deep-link ─────────────────────

  it('honours a selectedGymId route param by pre-expanding that gym (item 14 + 15a)', async () => {
    // Hotfix flow: MapScreen (after optimistic createGym) and GymDetail FAB
    // both deep-link in with ?selectedGymId=<id> so the user lands on the
    // list with that gym already expanded — no duplicate gym-pick step.
    setupReadyLocation();
    mockUseGymMachines.mockReturnValue(
      makeGymMachinesResult({
        isPending: false,
        isSuccess: true,
        data: SAMPLE_MACHINES,
        status: 'success',
      }),
    );
    mockUseLocalSearchParams.mockReturnValue({ selectedGymId: 'gym-1' });

    const { getByTestId } = renderScreen();

    await waitFor(() => {
      expect(getByTestId('machine-item-machine-1')).toBeTruthy();
      expect(getByTestId('machine-item-machine-2')).toBeTruthy();
    });
  });

  it('stays in list mode when selectedGymId is present (does not enter naver-search)', () => {
    setupReadyLocation();
    mockUseLocalSearchParams.mockReturnValue({ selectedGymId: 'gym-1' });

    const { queryByText } = renderScreen();

    expect(queryByText('새 헬스장 등록')).toBeNull();
  });

  it('ignores selectedGymId when openNewGym=1 is also present (precedence guard)', () => {
    // Phase 5 item 14 + 15a: openNewGym wins over selectedGymId. If both
    // params land on the same route (defensive: would never happen from
    // first-party callers, but easy to hit via deep-link), the screen
    // enters Naver-search mode without a stranded gym selection underneath.
    setupReadyLocation();
    mockUseLocalSearchParams.mockReturnValue({
      openNewGym: '1',
      selectedGymId: 'gym-1',
    });

    const { getByTestId, queryByTestId } = renderScreen();

    // Naver-search panel rendered.
    expect(getByTestId('naver-search-input')).toBeTruthy();
    // Machine sublist for gym-1 is NOT visible (would require list mode +
    // selected gym).
    expect(queryByTestId('machine-item-machine-1')).toBeNull();
  });
});
