import { fireEvent, render } from '@testing-library/react-native';
import { Image } from 'expo-image';
import type * as ReactType from 'react';

import type { Coordinate } from '@/shared/hooks/useCurrentLocation';
import type { GymWithMachineCount } from '@/shared/types/database';
import type * as BottomSheetMockModule from '@/test/utils/bottom-sheet-mock';

import { useGymMachines } from '../../hooks/useGymMachines';
import { GymBottomSheet, snapIndexForMode } from '../GymBottomSheet';

jest.mock('@react-navigation/bottom-tabs', () => ({
  useBottomTabBarHeight: jest.fn(() => 83),
}));

// Stand-in for expo-router's useFocusEffect: behaves like useEffect with [] so the
// "present + snap on mount" branch fires in unit tests where no navigation container
// is mounted. Returned cleanup runs on unmount, mirroring the real blur-on-tab-change
// dismiss path. Uses require() inside the factory because jest.mock hoists above
// imports and cannot reference outer-scope React.
jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactModule = require('react') as typeof ReactType;
  return {
    useFocusEffect: (effect: () => (() => void) | undefined) => {
      ReactModule.useEffect(effect, []);
    },
    // Phase 5 item 15a: GymDetail (rendered in detail mode) now embeds a
    // FAB that consumes `router.push`. The button isn't exercised in these
    // tests; a no-op stub keeps the render path quiet.
    router: { push: jest.fn() },
    useRouter: () => ({ push: jest.fn() }),
  };
});

// Phase 5 item 15a: GymDetail's FAB calls useRequireAuth. Bypass auth in
// these tests — the behaviour we care about lives on the list/detail
// branches, not on the gated upload entry.
jest.mock('@/features/auth/hooks/useRequireAuth', () => ({
  useRequireAuth: () => (action: () => void) => {
    action();
  },
}));

jest.mock('@gorhom/bottom-sheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mock = require('@/test/utils/bottom-sheet-mock') as typeof BottomSheetMockModule;
  return {
    __esModule: true,
    default: mock.BottomSheetPassthrough,
    BottomSheetModal: mock.BottomSheetModalPassthrough,
    BottomSheetModalProvider: mock.BottomSheetPassthrough,
    BottomSheetView: mock.BottomSheetPassthrough,
    BottomSheetFlatList: mock.BottomSheetListMock,
  };
});

// ADR 0022 follow-up (Task 46): GymDetail → MachineList → ReportReasonSheet
// transitive import of `burnt` (ESM not parsed by Jest).
jest.mock('@/features/photo/components/ReportReasonSheet', () => ({
  ReportReasonSheet: () => null,
}));

jest.mock('../../hooks/useGymMachines', () => ({
  useGymMachines: jest.fn(() => ({
    data: [],
    isPending: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  })),
}));

// Task 47 / Slice 47l: GymDetail → GymOwnerEntry consumes useCurrentUser + useQueue.
jest.mock('@/features/auth/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ data: undefined }),
}));
jest.mock('@/shared/generated/owner/owner', () => ({
  useQueue: () => ({ data: undefined }),
}));

const userLocation: Coordinate = { latitude: 37.4979, longitude: 127.0276 };

const fitnessFactory: GymWithMachineCount = {
  id: 'g-1',
  name: 'Fitness Factory',
  address: '서울 강남구 역삼동 123-4',
  latitude: 37.4985,
  longitude: 127.0282,
  phone: null,
  operating_hours: null,
  day_pass_price: null,
  is_verified: true,
  last_verified_at: '2026-03-15T10:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  machine_count: 12,
  matched_machine_names: [],
  cover_photo_url: null,
};

const strengthGym: GymWithMachineCount = {
  ...fitnessFactory,
  id: 'g-2',
  name: 'Strength Gym',
  latitude: 37.5547,
  longitude: 126.9707,
  machine_count: 8,
  matched_machine_names: [],
  cover_photo_url: null,
};

// The unregistered-detail CTA ('머신 사진 등록하기') is absolute-positioned at the
// sheet bottom and is clipped at the mid detent. snapIndexForMode is the pure
// decision that opens that mode at the full detent; the snap wiring itself is
// verified on the simulator (the gorhom modal mock exposes no imperative handle).
describe('snapIndexForMode', () => {
  it('opens the unregistered-detail mode at the full (90%) detent', () => {
    expect(snapIndexForMode('unregistered-detail')).toBe(2);
  });

  it('opens list and registered-detail modes at the mid (50%) detent', () => {
    expect(snapIndexForMode('list')).toBe(1);
    expect(snapIndexForMode('detail')).toBe(1);
  });
});

describe('GymBottomSheet (list mode)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders one GymCard per gym in the list', () => {
    const { getByText } = render(
      <GymBottomSheet
        mode={{
          type: 'list',
          gyms: [fitnessFactory, strengthGym],
          userLocation,
          isLoading: false,
          onSelectGym: () => undefined,
          onClearFilters: () => undefined,
        }}
      />,
    );
    expect(getByText('Fitness Factory')).toBeTruthy();
    expect(getByText('Strength Gym')).toBeTruthy();
  });

  it('threads cover_photo_url through to the GymCard thumbnail', () => {
    const withCover: GymWithMachineCount = {
      ...fitnessFactory,
      cover_photo_url: 'https://example.com/cover.jpg',
    };
    const { UNSAFE_queryAllByType } = render(
      <GymBottomSheet
        mode={{
          type: 'list',
          gyms: [withCover, strengthGym],
          userLocation,
          isLoading: false,
          onSelectGym: () => undefined,
          onClearFilters: () => undefined,
        }}
      />,
    );
    // Only the gym with a cover photo renders an Image; the other falls back
    // to the placeholder block.
    expect(UNSAFE_queryAllByType(Image)).toHaveLength(1);
  });

  it('renders haversine-derived distance for each card', () => {
    const { getByText } = render(
      <GymBottomSheet
        mode={{
          type: 'list',
          gyms: [fitnessFactory],
          userLocation,
          isLoading: false,
          onSelectGym: () => undefined,
          onClearFilters: () => undefined,
        }}
      />,
    );
    // Fitness Factory is ~80m from Gangnam Station: rounds to "0.1km"
    expect(getByText('0.1km')).toBeTruthy();
  });

  it('calls onSelectGym with the gym id when a card is tapped', () => {
    const onSelectGym = jest.fn();
    const { getByRole } = render(
      <GymBottomSheet
        mode={{
          type: 'list',
          gyms: [fitnessFactory, strengthGym],
          userLocation,
          isLoading: false,
          onSelectGym,
          onClearFilters: () => undefined,
        }}
      />,
    );
    fireEvent.press(getByRole('button', { name: /^Strength Gym/ }));
    expect(onSelectGym).toHaveBeenCalledWith('g-2');
  });

  it('renders registered GymCards above UnregisteredGymCards when interleaved (F7 + item 21)', () => {
    // Fitness Factory ≈ 0.1km (close) and Strength Gym is far. The Naver
    // place sits between them at ~0.2km from the user.
    const nearbyNaverPlace = {
      naverPlaceId: 'naver-mid',
      name: '강남 새 헬스장',
      address: '서울 강남구 역삼동 200',
      latitude: 37.4988,
      longitude: 127.0298,
    };
    const onUnregisteredPress = jest.fn();
    const { getByText, getByRole, queryAllByText } = render(
      <GymBottomSheet
        mode={{
          type: 'list',
          gyms: [fitnessFactory, strengthGym],
          unregisteredPlaces: [nearbyNaverPlace],
          userLocation,
          isLoading: false,
          onSelectGym: () => undefined,
          onUnregisteredPress,
          onClearFilters: () => undefined,
        }}
      />,
    );
    // All three rendered.
    expect(getByText('Fitness Factory')).toBeTruthy();
    expect(getByText('Strength Gym')).toBeTruthy();
    expect(getByText('강남 새 헬스장')).toBeTruthy();
    // CTA copy only on the unregistered card.
    expect(queryAllByText(/첫 등록자 되어 정보 추가하기/)).toHaveLength(1);
    // Tap unregistered card → callback called with the place.
    fireEvent.press(getByRole('button', { name: /강남 새 헬스장/ }));
    expect(onUnregisteredPress).toHaveBeenCalledWith(nearbyNaverPlace);
  });

  // Phase 5 item 21: launch-initial protection. With far-away registered
  // gyms and a nearby Naver place, the unregistered card would dominate
  // the 25% snap and the user would conclude "this app knows nothing
  // about Gangnam". Lock the registered ones above unregistered regardless
  // of distance so the first impression carries our actual catalogue.
  it('renders all registered gyms above unregistered places, even when registered are farther', () => {
    const farRegisteredGym: GymWithMachineCount = {
      ...fitnessFactory,
      id: 'g-far',
      name: 'Far Registered Gym',
      // ~5km from userLocation (강남역) — clearly farther than the nearby Naver place
      latitude: 37.5547,
      longitude: 126.9707,
    };
    const nearbyNaverPlace = {
      naverPlaceId: 'naver-near',
      name: '강남 가까운 헬스장',
      address: '서울 강남구 역삼동 200',
      // ~0.1km from userLocation — much closer than the registered gym
      latitude: 37.4985,
      longitude: 127.028,
    };
    const { getAllByTestId } = render(
      <GymBottomSheet
        mode={{
          type: 'list',
          gyms: [farRegisteredGym],
          unregisteredPlaces: [nearbyNaverPlace],
          userLocation,
          isLoading: false,
          hasActiveFilters: false,
          onSelectGym: () => undefined,
          onUnregisteredPress: () => undefined,
          onClearFilters: () => undefined,
        }}
      />,
    );
    const cards = getAllByTestId(/^(gym-card|unregistered-gym-card)-/);
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveProp('testID', 'gym-card-far-registered-gym');
    expect(cards[1]).toHaveProp('testID', 'unregistered-gym-card-강남-가까운-헬스장');
  });

  // Phase 5 item 21: within the registered group, distance still wins —
  // option A is "registered first, then distance", not "registered first,
  // unsorted within".
  it('sorts registered gyms by distance among themselves', () => {
    const farRegisteredGym: GymWithMachineCount = {
      ...fitnessFactory,
      id: 'g-far',
      name: 'Far Registered Gym',
      latitude: 37.5547,
      longitude: 126.9707,
    };
    const { getAllByTestId } = render(
      <GymBottomSheet
        mode={{
          type: 'list',
          gyms: [farRegisteredGym, fitnessFactory], // intentionally far-first
          userLocation,
          isLoading: false,
          hasActiveFilters: false,
          onSelectGym: () => undefined,
          onClearFilters: () => undefined,
        }}
      />,
    );
    const cards = getAllByTestId(/^gym-card-/);
    expect(cards[0]).toHaveProp('testID', 'gym-card-fitness-factory'); // closer
    expect(cards[1]).toHaveProp('testID', 'gym-card-far-registered-gym'); // farther
  });

  it('renders only UnregisteredGymCards when gyms is empty but Naver merge returns places', () => {
    // Pre-launch / area-empty case: IronSpot DB empty in this area, Naver
    // returned 2 candidates. The empty state must NOT show — the user sees
    // CTA cards inviting them to become the first registrant.
    const { getByText, queryByText } = render(
      <GymBottomSheet
        mode={{
          type: 'list',
          gyms: [],
          unregisteredPlaces: [
            {
              naverPlaceId: 'naver-1',
              name: '신규 헬스장 A',
              address: '서울 강남구 역삼동 1',
              latitude: 37.4985,
              longitude: 127.0285,
            },
            {
              naverPlaceId: 'naver-2',
              name: '신규 헬스장 B',
              address: '서울 강남구 역삼동 2',
              latitude: 37.499,
              longitude: 127.029,
            },
          ],
          userLocation,
          isLoading: false,
          onSelectGym: () => undefined,
          onUnregisteredPress: () => undefined,
          onClearFilters: () => undefined,
        }}
      />,
    );
    expect(getByText('신규 헬스장 A')).toBeTruthy();
    expect(getByText('신규 헬스장 B')).toBeTruthy();
    expect(queryByText('조건에 맞는 헬스장이 없어요')).toBeNull();
    expect(queryByText('필터를 조정해보세요')).toBeNull();
  });

  it('shows an empty state with filter-tuning copy when the gyms array is empty AND filters are active', () => {
    const { getByText } = render(
      <GymBottomSheet
        mode={{
          type: 'list',
          gyms: [],
          userLocation,
          isLoading: false,
          hasActiveFilters: true,
          onSelectGym: () => undefined,
          onClearFilters: () => undefined,
        }}
      />,
    );
    expect(getByText('조건에 맞는 헬스장이 없어요')).toBeTruthy();
    expect(getByText('필터를 조정해보세요')).toBeTruthy();
  });

  // Phase 5 item 20: filter-tuning copy is misleading when the user hasn't
  // touched any filters. Filter-inactive empty state must use neutral copy.
  it('shows a "viewport empty" copy when the gyms array is empty AND no filters are active', () => {
    const { getByText, queryByRole } = render(
      <GymBottomSheet
        mode={{
          type: 'list',
          gyms: [],
          userLocation,
          isLoading: false,
          hasActiveFilters: false,
          onSelectGym: () => undefined,
          onClearFilters: () => undefined,
        }}
      />,
    );
    expect(getByText('이 주변엔 아직 등록된 헬스장이 없어요')).toBeTruthy();
    expect(getByText('지도를 옮기거나 검색해보세요')).toBeTruthy();
    // The "필터 초기화" button is misleading when there are no active filters.
    expect(queryByRole('button', { name: '필터 초기화' })).toBeNull();
    // Filter-tuning copy must NOT leak into this branch.
    expect(queryByRole('button', { name: '조건 바꿔서 검색' })).toBeNull();
  });

  // Phase 5 item 20: defaulting to the "viewport empty" copy when
  // hasActiveFilters is omitted is the safe fallback — misleading
  // filter-tuning copy must not regress when callers forget the prop.
  it('defaults to the "viewport empty" copy when hasActiveFilters is omitted', () => {
    const { getByText, queryByRole } = render(
      <GymBottomSheet
        mode={{
          type: 'list',
          gyms: [],
          userLocation,
          isLoading: false,
          onSelectGym: () => undefined,
          onClearFilters: () => undefined,
        }}
      />,
    );
    expect(getByText('이 주변엔 아직 등록된 헬스장이 없어요')).toBeTruthy();
    expect(queryByRole('button', { name: '필터 초기화' })).toBeNull();
  });

  it('renders a "필터 초기화" button in the filter-active empty state', () => {
    const { getByRole } = render(
      <GymBottomSheet
        mode={{
          type: 'list',
          gyms: [],
          userLocation,
          isLoading: false,
          hasActiveFilters: true,
          onSelectGym: () => undefined,
          onClearFilters: () => undefined,
        }}
      />,
    );
    expect(getByRole('button', { name: '필터 초기화' })).toBeTruthy();
  });

  it('invokes onClearFilters when the filter-active empty-state button is pressed', () => {
    const onClearFilters = jest.fn();
    const { getByRole } = render(
      <GymBottomSheet
        mode={{
          type: 'list',
          gyms: [],
          userLocation,
          isLoading: false,
          hasActiveFilters: true,
          onSelectGym: () => undefined,
          onClearFilters,
        }}
      />,
    );
    fireEvent.press(getByRole('button', { name: '필터 초기화' }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });

  it('renders three gym-card skeletons while isLoading is true', () => {
    const { getAllByTestId, queryByText } = render(
      <GymBottomSheet
        mode={{
          type: 'list',
          gyms: [],
          userLocation,
          isLoading: true,
          onSelectGym: () => undefined,
          onClearFilters: () => undefined,
        }}
      />,
    );
    expect(getAllByTestId('gym-card-skeleton')).toHaveLength(3);
    // The empty-state copy must not show during loading — it would race with the
    // skeleton and double-message the user.
    expect(queryByText('조건에 맞는 헬스장이 없어요')).toBeNull();
  });

  it('does not render skeletons when isLoading is false and gyms exist', () => {
    const { queryAllByTestId } = render(
      <GymBottomSheet
        mode={{
          type: 'list',
          gyms: [fitnessFactory],
          userLocation,
          isLoading: false,
          onSelectGym: () => undefined,
          onClearFilters: () => undefined,
        }}
      />,
    );
    expect(queryAllByTestId('gym-card-skeleton')).toHaveLength(0);
  });
});

// Detail-mode-wins-over-loading is now encoded in the discriminated union
// (`type: 'detail'` has no `isLoading` field), so the runtime precedence
// test from the previous flat-props design has been retired — the type
// system enforces the contract at compile time.
describe('GymBottomSheet (detail mode)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useGymMachines as jest.Mock).mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    });
  });

  it('renders GymDetail when mode.type is "detail"', () => {
    const { getByRole } = render(
      <GymBottomSheet
        mode={{
          type: 'detail',
          selectedGym: fitnessFactory,
          onCloseDetail: () => undefined,
          onPressMachine: () => undefined,
        }}
      />,
    );
    expect(getByRole('header', { name: 'Fitness Factory' })).toBeTruthy();
  });

  it('exposes a back button that calls onCloseDetail when tapped', () => {
    const onCloseDetail = jest.fn();
    const { getByRole } = render(
      <GymBottomSheet
        mode={{
          type: 'detail',
          selectedGym: fitnessFactory,
          onCloseDetail,
          onPressMachine: () => undefined,
        }}
      />,
    );
    fireEvent.press(getByRole('button', { name: '목록으로 돌아가기' }));
    expect(onCloseDetail).toHaveBeenCalledTimes(1);
  });
});
