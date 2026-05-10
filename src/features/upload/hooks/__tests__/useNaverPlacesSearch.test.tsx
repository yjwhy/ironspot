import { renderHook } from '@testing-library/react-native';

import { useSearchPlaces } from '@/shared/generated/gyms/gyms';
import type { NaverPlaceResult } from '@/shared/generated/model/naverPlaceResult';

import { useNaverPlacesSearch } from '../useNaverPlacesSearch';

jest.mock('@/shared/generated/gyms/gyms', () => ({
  useSearchPlaces: jest.fn(),
}));

const mockedUseSearchPlaces = useSearchPlaces as jest.Mock;

const SAMPLE: NaverPlaceResult[] = [
  {
    id: 'p1',
    name: '에어짐',
    address: '서울 강남구 1',
    roadAddress: '서울특별시 강남대로 1',
    latitude: 37.5,
    longitude: 127.03,
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseSearchPlaces.mockReturnValue({
    data: undefined,
    isFetching: false,
    isError: false,
  });
});

describe('useNaverPlacesSearch', () => {
  function lastCallEnabled(): boolean {
    const calls = mockedUseSearchPlaces.mock.calls as [unknown, { query: { enabled: boolean } }][];
    const last = calls.at(-1);
    if (!last) throw new Error('useSearchPlaces was not called');
    return last[1].query.enabled;
  }

  function lastCallQuery(): unknown {
    const calls = mockedUseSearchPlaces.mock.calls as [{ query: string }, unknown][];
    const last = calls.at(-1);
    if (!last) throw new Error('useSearchPlaces was not called');
    return last[0];
  }

  it('returns empty result and disables the underlying query for short input', () => {
    const { result } = renderHook(() => useNaverPlacesSearch('헬'));

    expect(result.current.places).toEqual([]);
    expect(lastCallQuery()).toEqual({ query: '헬' });
    expect(lastCallEnabled()).toBe(false);
  });

  it('returns empty result and disables the underlying query for whitespace-only input', () => {
    const { result } = renderHook(() => useNaverPlacesSearch('   '));

    expect(result.current.places).toEqual([]);
    expect(lastCallQuery()).toEqual({ query: '' });
    expect(lastCallEnabled()).toBe(false);
  });

  it('enables the query and returns places for a long-enough query', () => {
    mockedUseSearchPlaces.mockReturnValue({
      data: { data: SAMPLE, status: 200 },
      isFetching: false,
      isError: false,
    });

    const { result } = renderHook(() => useNaverPlacesSearch('헬스장'));

    expect(result.current.places).toEqual(SAMPLE);
    expect(lastCallQuery()).toEqual({ query: '헬스장' });
    expect(lastCallEnabled()).toBe(true);
  });

  it('suppresses isError when the underlying query is disabled', () => {
    mockedUseSearchPlaces.mockReturnValue({
      data: undefined,
      isFetching: false,
      isError: true,
    });

    const { result } = renderHook(() => useNaverPlacesSearch('a'));
    expect(result.current.isError).toBe(false);
  });

  it('exposes isError when the underlying query is enabled and errored', () => {
    mockedUseSearchPlaces.mockReturnValue({
      data: undefined,
      isFetching: false,
      isError: true,
    });

    const { result } = renderHook(() => useNaverPlacesSearch('헬스장'));
    expect(result.current.isError).toBe(true);
  });
});
