import { fireEvent, render } from '@testing-library/react-native';

import type { Coordinate } from '@/shared/hooks/useCurrentLocation';
import type { GymWithMachineCount } from '@/shared/types/database';
import type * as BottomSheetMockModule from '@/test/utils/bottom-sheet-mock';

import { useGymMachines } from '../../hooks/useGymMachines';
import { GymBottomSheet } from '../GymBottomSheet';

jest.mock('@react-navigation/bottom-tabs', () => ({
  useBottomTabBarHeight: jest.fn(() => 83),
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
    useBottomSheetScrollableCreator: jest.fn(() => jest.fn()),
    useBottomSheetModal: jest.fn(() => ({ dismiss: jest.fn(), dismissAll: jest.fn() })),
  };
});

jest.mock('@shopify/flash-list', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mock = require('@/test/utils/bottom-sheet-mock') as typeof BottomSheetMockModule;
  return { FlashList: mock.BottomSheetListMock };
});

jest.mock('../../hooks/useGymMachines', () => ({
  useGymMachines: jest.fn(() => ({
    data: [],
    isPending: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  })),
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
};

const strengthGym: GymWithMachineCount = {
  ...fitnessFactory,
  id: 'g-2',
  name: 'Strength Gym',
  latitude: 37.5547,
  longitude: 126.9707,
  machine_count: 8,
};

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

  it('shows an empty state with filter-tuning copy when the gyms array is empty', () => {
    const { getByText } = render(
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
    expect(getByText('조건에 맞는 헬스장이 없어요')).toBeTruthy();
    expect(getByText('필터를 조정해보세요')).toBeTruthy();
  });

  it('renders a "필터 초기화" button in the empty state', () => {
    const { getByRole } = render(
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
    expect(getByRole('button', { name: '필터 초기화' })).toBeTruthy();
  });

  it('invokes onClearFilters when the empty-state button is pressed', () => {
    const onClearFilters = jest.fn();
    const { getByRole } = render(
      <GymBottomSheet
        mode={{
          type: 'list',
          gyms: [],
          userLocation,
          isLoading: false,
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
