import { renderHook } from '@testing-library/react-native';
import * as burnt from 'burnt';

import { useCreateGym as useCreateGymMutation } from '@/shared/generated/gyms/gyms';
import type { GymDetailResponse } from '@/shared/generated/model/gymDetailResponse';
import type { NaverPlaceResult } from '@/shared/generated/model/naverPlaceResult';
import { HTTPError, TimeoutError } from '@/shared/lib/api-client';

import { useCreateGym } from '../useCreateGym';

jest.mock('@/shared/generated/gyms/gyms', () => ({
  useCreateGym: jest.fn(),
}));

const mockInvalidateQueries = jest.fn();
jest.mock('@tanstack/react-query', () => {
  const actual: Record<string, unknown> = jest.requireActual('@tanstack/react-query');
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
  };
});

jest.mock('burnt', () => ({
  toast: jest.fn(),
}));

const mockedUseCreateGym = useCreateGymMutation as jest.Mock;

interface CapturedOptions {
  mutation?: {
    onSuccess?: (response: { data: GymDetailResponse; status: number }) => void;
    onError?: (err: unknown) => void;
  };
}

function setupHook(opts?: { onSuccess?: (gym: GymDetailResponse) => void }) {
  const mutate = jest.fn();
  let captured: CapturedOptions | undefined;
  mockedUseCreateGym.mockImplementation((options: CapturedOptions) => {
    captured = options;
    return { mutate, isPending: false };
  });

  const { result } = renderHook(() => useCreateGym(opts));
  return {
    result,
    mutate,
    getCaptured: () => {
      if (!captured) throw new Error('Mutation options were not captured');
      return captured;
    },
  };
}

const PLACE: NaverPlaceResult = {
  id: 'p123',
  name: '에어짐 강남',
  address: '서울 강남구 테헤란로 1',
  roadAddress: '서울특별시 테헤란로 1',
  latitude: 37.4979,
  longitude: 127.0276,
  phone: '02-1111-2222',
  category: '스포츠시설>헬스장',
};

const CREATED_GYM: GymDetailResponse = {
  id: 'gym-1',
  name: PLACE.name,
  address: PLACE.roadAddress,
  latitude: PLACE.latitude,
  longitude: PLACE.longitude,
  isVerified: false,
  createdAt: '2026-05-11T00:00:00Z',
  updatedAt: '2026-05-11T00:00:00Z',
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useCreateGym', () => {
  it('maps NaverPlaceResult fields onto CreateGymRequest', () => {
    const { result, mutate } = setupHook();

    result.current.handleCreateGym(PLACE);

    expect(mutate).toHaveBeenCalledWith({
      data: {
        name: '에어짐 강남',
        address: '서울특별시 테헤란로 1',
        latitude: 37.4979,
        longitude: 127.0276,
        naverPlaceId: 'p123',
        phone: '02-1111-2222',
      },
    });
  });

  it('omits phone from the payload when the source place has no phone', () => {
    const { result, mutate } = setupHook();

    result.current.handleCreateGym({ ...PLACE, phone: undefined });

    const calls = mutate.mock.calls as [{ data: Record<string, unknown> }][];
    const lastCall = calls.at(-1);
    if (!lastCall) throw new Error('mutate was not called');
    expect(lastCall[0].data).not.toHaveProperty('phone');
  });

  it('shows success toast, invalidates map cache, and calls onSuccess on mutation success', () => {
    const onSuccess = jest.fn();
    const { getCaptured } = setupHook({ onSuccess });

    // Orval wraps responses as { data, status, headers } — onSuccess receives the envelope.
    getCaptured().mutation?.onSuccess?.({ data: CREATED_GYM, status: 200 });

    expect(burnt.toast).toHaveBeenCalledWith(expect.objectContaining({ preset: 'done' }));
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['map'] });
    expect(onSuccess).toHaveBeenCalledWith(CREATED_GYM);
  });

  it('shows error toast on HTTPError (real server failure)', () => {
    const { getCaptured } = setupHook();

    // ky's HTTPError is the canonical "non-2xx response" failure — show the
    // error toast for these.
    const httpErr = Object.create(HTTPError.prototype) as HTTPError;
    getCaptured().mutation?.onError?.(httpErr);

    expect(burnt.toast).toHaveBeenCalledWith(expect.objectContaining({ preset: 'error' }));
  });

  it('shows error toast on TimeoutError (request never reached server)', () => {
    const { getCaptured } = setupHook();

    const timeoutErr = Object.create(TimeoutError.prototype) as TimeoutError;
    getCaptured().mutation?.onError?.(timeoutErr);

    expect(burnt.toast).toHaveBeenCalledWith(expect.objectContaining({ preset: 'error' }));
  });

  it('suppresses the toast for cancelled/aborted fetches (Phase 5 hotfix 2026-05-21)', () => {
    // The unregistered-card-tap race fires two parallel POST /api/gyms; one
    // commits, the other is cancelled mid-flight by NSURLSession connection
    // racing. The cancelled fetch rejects with a generic Error (not
    // HTTPError, not TimeoutError). Showing the failure toast for these is
    // a lie because the gym row exists. The MapScreen ref-lock is the
    // first defence; this is the second.
    const { getCaptured } = setupHook();

    getCaptured().mutation?.onError?.(new Error('The operation was aborted'));

    expect(burnt.toast).not.toHaveBeenCalledWith(expect.objectContaining({ preset: 'error' }));
  });

  it('calls the caller-supplied onError so MapScreen can clear its pending-id tracking (item 14)', () => {
    // Phase 5 item 14: MapScreen tracks `lastPressedUnregisteredPlaceId` and
    // wants symmetric cleanup on success + error rather than relying on the
    // gated `isPending` derivation alone.
    const onError = jest.fn();
    const mutate = jest.fn();
    let captured: CapturedOptions | undefined;
    mockedUseCreateGym.mockImplementation((options: CapturedOptions) => {
      captured = options;
      return { mutate, isPending: false };
    });
    renderHook(() => useCreateGym({ onError }));

    captured?.mutation?.onError?.(new Error('boom'));

    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('maps UnregisteredPlace fields onto CreateGymRequest via handleCreateGymFromUnregisteredPlace', () => {
    // Phase 5 item 14: MapScreen taps an UnregisteredGymCard and calls this
    // helper to skip the duplicate Naver-search step. UnregisteredPlace
    // carries a flat `address` (road-name with jibun fallback) so we map it
    // straight onto CreateGymRequest.address without indirection.
    const { result, mutate } = setupHook();

    result.current.handleCreateGymFromUnregisteredPlace({
      naverPlaceId: 'naver-77',
      name: '미등록 헬스장',
      address: '서울 강남구 역삼동 99',
      latitude: 37.5,
      longitude: 127.04,
    });

    expect(mutate).toHaveBeenCalledWith({
      data: {
        name: '미등록 헬스장',
        address: '서울 강남구 역삼동 99',
        latitude: 37.5,
        longitude: 127.04,
        naverPlaceId: 'naver-77',
      },
    });
  });
});
