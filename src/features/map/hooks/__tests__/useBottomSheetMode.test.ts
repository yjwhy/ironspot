import { act, renderHook } from '@testing-library/react-native';

import type { Coordinate } from '@/shared/hooks/useCurrentLocation';
import type { GymWithMachineCount } from '@/shared/types/database';

import { useBottomSheetMode } from '../useBottomSheetMode';

const makeGym = (id: string): GymWithMachineCount => ({
  id,
  name: 'Test Gym',
  address: '123 Test St',
  latitude: 37.49,
  longitude: 127.03,
  phone: null,
  operating_hours: null,
  day_pass_price: null,
  is_verified: false,
  last_verified_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  machine_count: 2,
  matched_machine_names: [],
});

const USER_LOCATION: Coordinate = { latitude: 37.498, longitude: 127.028 };
const NO_GYMS: readonly GymWithMachineCount[] = [];

function makeParams(overrides: Partial<Parameters<typeof useBottomSheetMode>[0]> = {}) {
  return {
    gyms: NO_GYMS,
    isPending: false,
    userLocation: USER_LOCATION,
    clearFilters: jest.fn(),
    onPressMachine: jest.fn(),
    onPressRegisterFirstPhoto: jest.fn(),
    ...overrides,
  };
}

describe('useBottomSheetMode', () => {
  it('starts in list mode', () => {
    const { result } = renderHook(() => useBottomSheetMode(makeParams()));
    expect(result.current.mode.type).toBe('list');
  });

  it('switches to detail mode when a gym is selected', () => {
    const gyms = [makeGym('g1')];
    const { result } = renderHook(() => useBottomSheetMode(makeParams({ gyms })));

    act(() => {
      result.current.setSelectedGymId('g1');
    });

    expect(result.current.mode.type).toBe('detail');
    if (result.current.mode.type === 'detail') {
      expect(result.current.mode.selectedGym.id).toBe('g1');
    }
  });

  it('exposes selectedGymId', () => {
    const gyms = [makeGym('g1')];
    const { result } = renderHook(() => useBottomSheetMode(makeParams({ gyms })));

    act(() => {
      result.current.setSelectedGymId('g1');
    });

    expect(result.current.selectedGymId).toBe('g1');
  });

  it('clears selectedGymId when the selected gym leaves the list', () => {
    const gyms = [makeGym('g1'), makeGym('g2')];
    const { result, rerender } = renderHook(
      ({ g }: { g: readonly GymWithMachineCount[] }) => useBottomSheetMode(makeParams({ gyms: g })),
      { initialProps: { g: gyms } },
    );

    act(() => {
      result.current.setSelectedGymId('g1');
    });
    expect(result.current.selectedGymId).toBe('g1');

    rerender({ g: [makeGym('g2')] });
    expect(result.current.selectedGymId).toBeNull();
  });

  it('onCloseDetail resets to list mode', () => {
    const gyms = [makeGym('g1')];
    const { result } = renderHook(() => useBottomSheetMode(makeParams({ gyms })));

    act(() => {
      result.current.setSelectedGymId('g1');
    });
    expect(result.current.mode.type).toBe('detail');

    act(() => {
      if (result.current.mode.type === 'detail') {
        result.current.mode.onCloseDetail();
      }
    });

    expect(result.current.mode.type).toBe('list');
  });

  it('onPressMachine calls the provided callback with gymId and machineId', () => {
    const onPressMachine = jest.fn();
    const gyms = [makeGym('g1')];
    const { result } = renderHook(() => useBottomSheetMode(makeParams({ gyms, onPressMachine })));

    act(() => {
      result.current.setSelectedGymId('g1');
    });

    act(() => {
      if (result.current.mode.type === 'detail') {
        result.current.mode.onPressMachine('m1');
      }
    });

    expect(onPressMachine).toHaveBeenCalledWith('g1', 'm1');
  });

  it('passes pendingUnregisteredPlaceId through to the list mode payload', () => {
    // Phase 5 item 14: the in-flight optimistic createGym mutation is
    // tracked by MapScreen; the bottom sheet renders the matching card
    // with a spinner. The hook just plumbs the value through.
    const { result } = renderHook(() =>
      useBottomSheetMode(makeParams({ pendingUnregisteredPlaceId: 'naver-42' })),
    );
    expect(result.current.mode.type).toBe('list');
    if (result.current.mode.type === 'list') {
      expect(result.current.mode.pendingUnregisteredPlaceId).toBe('naver-42');
    }
  });

  it('defaults pendingUnregisteredPlaceId to null when omitted', () => {
    const { result } = renderHook(() => useBottomSheetMode(makeParams()));
    if (result.current.mode.type === 'list') {
      expect(result.current.mode.pendingUnregisteredPlaceId ?? null).toBeNull();
    }
  });
});
