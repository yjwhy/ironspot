import { renderHook, waitFor } from '@testing-library/react-native';

import type { MachinePhoto } from '@/shared/types/database';
import { makeMachinePhoto } from '@/test/utils/factories/gym-machine';
import { createQueryWrapper } from '@/test/utils/query-wrapper';

import { getMachinePhotos } from '../../services/photo-list';
import { useMachinePhotos } from '../useMachinePhotos';

jest.mock('../../services/photo-list', () => ({
  getMachinePhotos: jest.fn(),
}));

const fixture: MachinePhoto[] = [
  makeMachinePhoto({ upvote_count: 5 }),
  makeMachinePhoto({ id: 'p-2', upvote_count: 1 }),
];

describe('useMachinePhotos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('is disabled when gymMachineId is an empty string and does not call the service', () => {
    const mockGet = getMachinePhotos as jest.MockedFunction<typeof getMachinePhotos>;
    const { Wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useMachinePhotos(''), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('is disabled when gymMachineId is undefined and does not call the service', () => {
    const mockGet = getMachinePhotos as jest.MockedFunction<typeof getMachinePhotos>;
    const { Wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useMachinePhotos(undefined), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('calls getMachinePhotos with the provided gymMachineId when set', async () => {
    const mockGet = getMachinePhotos as jest.MockedFunction<typeof getMachinePhotos>;
    mockGet.mockResolvedValue(fixture);
    const { Wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useMachinePhotos('gm-1'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith('gm-1');
  });

  it('returns the data on success', async () => {
    const mockGet = getMachinePhotos as jest.MockedFunction<typeof getMachinePhotos>;
    mockGet.mockResolvedValue(fixture);
    const { Wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useMachinePhotos('gm-1'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(fixture);
  });

  it('exposes an error state when the service rejects', async () => {
    const mockGet = getMachinePhotos as jest.MockedFunction<typeof getMachinePhotos>;
    mockGet.mockRejectedValue(new Error('boom'));
    const { Wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useMachinePhotos('gm-1'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
  });

  it('refetches when gymMachineId changes (distinct query keys per id)', async () => {
    const mockGet = getMachinePhotos as jest.MockedFunction<typeof getMachinePhotos>;
    mockGet.mockResolvedValue(fixture);
    const { Wrapper } = createQueryWrapper();

    const { result, rerender } = renderHook(({ id }: { id: string }) => useMachinePhotos(id), {
      wrapper: Wrapper,
      initialProps: { id: 'gm-1' },
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(mockGet).toHaveBeenCalledWith('gm-1');

    rerender({ id: 'gm-2' });

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('gm-2');
    });
    expect(mockGet).toHaveBeenCalledTimes(2);
  });
});
