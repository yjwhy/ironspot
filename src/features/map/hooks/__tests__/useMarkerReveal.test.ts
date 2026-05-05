import { act, renderHook } from '@testing-library/react-native';

import type { GymWithMachineCount } from '@/shared/types/database';

import { useMarkerReveal } from '../useMarkerReveal';

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
});

const NO_GYMS: readonly GymWithMachineCount[] = [];

describe('useMarkerReveal', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts with empty visible ids', () => {
    const { result } = renderHook(() => useMarkerReveal(NO_GYMS));
    expect(result.current.visibleMarkerIds).toEqual([]);
  });

  it('reveals markers one by one with stagger delay', () => {
    const gyms = [makeGym('a'), makeGym('b'), makeGym('c')];
    const { result } = renderHook(() => useMarkerReveal(gyms));

    expect(result.current.visibleMarkerIds).toEqual([]);

    act(() => {
      jest.advanceTimersByTime(0);
    });
    expect(result.current.visibleMarkerIds).toContain('a');
    expect(result.current.visibleMarkerIds).not.toContain('b');

    act(() => {
      jest.advanceTimersByTime(60);
    });
    expect(result.current.visibleMarkerIds).toContain('b');
    expect(result.current.visibleMarkerIds).not.toContain('c');

    act(() => {
      jest.advanceTimersByTime(60);
    });
    expect(result.current.visibleMarkerIds).toContain('c');
  });

  it('resets visible ids when gyms change', () => {
    const gyms = [makeGym('a'), makeGym('b')];
    const { result, rerender } = renderHook(
      ({ g }: { g: readonly GymWithMachineCount[] }) => useMarkerReveal(g),
      { initialProps: { g: gyms } },
    );

    act(() => {
      jest.runAllTimers();
    });
    expect(result.current.visibleMarkerIds).toHaveLength(2);

    const newGyms = [makeGym('x')];
    rerender({ g: newGyms });

    expect(result.current.visibleMarkerIds).toEqual([]);
  });

  it('clears visible ids immediately when gyms become empty', () => {
    const gyms = [makeGym('a')];
    const { result, rerender } = renderHook(
      ({ g }: { g: readonly GymWithMachineCount[] }) => useMarkerReveal(g),
      { initialProps: { g: gyms } },
    );

    act(() => {
      jest.runAllTimers();
    });

    rerender({ g: [] });
    expect(result.current.visibleMarkerIds).toEqual([]);
  });
});
