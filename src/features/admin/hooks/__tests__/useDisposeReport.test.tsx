import { act, renderHook } from '@testing-library/react-native';

import { useDisposition } from '@/shared/generated/admin/admin';
import { captureMutation } from '@/test/utils/mutation-mock';
import { createQueryWrapper } from '@/test/utils/query-wrapper';

import { adminKeys } from '../../query-keys';
import { useDisposeReport } from '../useDisposeReport';

jest.mock('@/shared/generated/admin/admin', () => ({ useDisposition: jest.fn() }));
jest.mock('burnt', () => ({ toast: jest.fn() }));

const useDispositionMock = useDisposition as jest.Mock;

interface CapturedOptions {
  mutation?: {
    onSuccess?: (data: unknown, variables: { id: string; data: { disposition: string } }) => void;
    onError?: (err: unknown) => void;
  };
}

function setupMutation() {
  return captureMutation<CapturedOptions>(useDispositionMock);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useDisposeReport', () => {
  it('dispatches useDisposition.mutate with the supplied reportId and disposition', () => {
    const { mutate } = setupMutation();
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(
      () => useDisposeReport('r-1', { type: 'photo', photoId: 'p-1' }),
      { wrapper: Wrapper },
    );

    act(() => {
      result.current.handleDispose({ disposition: 'actioned' });
    });

    expect(mutate).toHaveBeenCalledWith({ id: 'r-1', data: { disposition: 'actioned' } });
  });

  it('invalidates the pending queue and photo detail caches on success', () => {
    const { getOptions } = setupMutation();
    const { Wrapper, client } = createQueryWrapper();
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');
    renderHook(() => useDisposeReport('r-1', { type: 'photo', photoId: 'p-1' }), {
      wrapper: Wrapper,
    });

    act(() => {
      getOptions()?.mutation?.onSuccess?.(undefined, {
        id: 'r-1',
        data: { disposition: 'actioned' },
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: adminKeys.pendingPhotos() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: adminKeys.photoDetail('p-1') });
  });
});
