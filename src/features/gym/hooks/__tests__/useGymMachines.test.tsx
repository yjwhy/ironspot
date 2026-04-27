import { renderHook, waitFor } from '@testing-library/react-native';

import type { GymMachineWithDetails } from '@/shared/types/database';
import { createQueryWrapper } from '@/test/utils/query-wrapper';

import { getGymMachines } from '../../services/gym-detail';
import { useGymMachines } from '../useGymMachines';

jest.mock('../../services/gym-detail', () => ({
  getGymMachines: jest.fn(),
}));

const fixture: GymMachineWithDetails[] = [
  {
    id: 'gm-1',
    gym_id: 'g-1',
    template_id: 't-1',
    quantity: 1,
    is_custom: false,
    custom_name: null,
    last_verified_at: null,
    created_at: '2026-04-01',
    template: {
      id: 't-1',
      brand_id: 'b-1',
      category_id: 'c-1',
      name: 'High Row',
      loading_type: 'plate',
      is_approved: true,
      created_at: '2026-04-01',
      brand: { id: 'b-1', name: 'Panatta' },
      category: { id: 'c-1', name: 'Back' },
    },
    photos: [],
  },
];

describe('useGymMachines', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('is disabled when gymId is empty and does not call the service', () => {
    const mockGet = getGymMachines as jest.MockedFunction<typeof getGymMachines>;
    const { Wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useGymMachines(''), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('calls getGymMachines with the provided gymId when gymId is set', async () => {
    const mockGet = getGymMachines as jest.MockedFunction<typeof getGymMachines>;
    mockGet.mockResolvedValue(fixture);
    const { Wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useGymMachines('g-1'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith('g-1');
  });

  it('returns the data on success', async () => {
    const mockGet = getGymMachines as jest.MockedFunction<typeof getGymMachines>;
    mockGet.mockResolvedValue(fixture);
    const { Wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useGymMachines('g-1'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(fixture);
  });

  it('exposes an error state when the service rejects', async () => {
    const mockGet = getGymMachines as jest.MockedFunction<typeof getGymMachines>;
    mockGet.mockRejectedValue(new Error('boom'));
    const { Wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useGymMachines('g-1'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
  });

  it('refetches when gymId changes (distinct query keys per id)', async () => {
    const mockGet = getGymMachines as jest.MockedFunction<typeof getGymMachines>;
    mockGet.mockResolvedValue(fixture);
    const { Wrapper } = createQueryWrapper();

    const { result, rerender } = renderHook(({ id }: { id: string }) => useGymMachines(id), {
      wrapper: Wrapper,
      initialProps: { id: 'g-1' },
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(mockGet).toHaveBeenCalledWith('g-1');

    rerender({ id: 'g-2' });

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('g-2');
    });
    expect(mockGet).toHaveBeenCalledTimes(2);
  });
});
