import { renderHook, waitFor } from '@testing-library/react-native';

import type { Gym } from '@/shared/types/database';
import { createQueryWrapper } from '@/test/utils/query-wrapper';

import { getGymById } from '../../services/gym-detail';
import { useGymDetail } from '../useGymDetail';

jest.mock('../../services/gym-detail', () => ({
  getGymById: jest.fn(),
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
};

describe('useGymDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('is disabled when gymId is empty string and does not call the service', () => {
    const mockGet = getGymById as jest.MockedFunction<typeof getGymById>;
    const { Wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useGymDetail(''), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('is disabled when gymId is undefined', () => {
    const mockGet = getGymById as jest.MockedFunction<typeof getGymById>;
    const { Wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useGymDetail(undefined), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('calls getGymById with the provided gymId on mount', async () => {
    const mockGet = getGymById as jest.MockedFunction<typeof getGymById>;
    mockGet.mockResolvedValue(sampleGym);
    const { Wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useGymDetail('g-1'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockGet).toHaveBeenCalledWith('g-1');
    expect(result.current.data).toEqual(sampleGym);
  });

  it('exposes an error state when the service rejects', async () => {
    const mockGet = getGymById as jest.MockedFunction<typeof getGymById>;
    mockGet.mockRejectedValue(new Error('boom'));
    const { Wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useGymDetail('g-1'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toBeInstanceOf(Error);
  });
});
