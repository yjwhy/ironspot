import { act, renderHook } from '@testing-library/react-native';
import * as burnt from 'burnt';

import { usePromote } from '@/shared/generated/admin-contributions/admin-contributions';
import { captureMutation } from '@/test/utils/mutation-mock';
import { createQueryWrapper } from '@/test/utils/query-wrapper';

import { adminKeys } from '../../query-keys';
import { usePromoteContribution } from '../usePromoteContribution';

jest.mock('@/shared/generated/admin-contributions/admin-contributions', () => ({
  usePromote: jest.fn(),
}));
jest.mock('burnt', () => ({ toast: jest.fn() }));

const usePromoteMock = usePromote as jest.Mock;

interface CapturedOptions {
  mutation?: {
    onSuccess?: (response: { data: { mergedIntoGymMachineId?: string } }) => void;
    onError?: () => void;
  };
}

function setupMutation() {
  return captureMutation<CapturedOptions>(usePromoteMock);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('usePromoteContribution', () => {
  it('mutates with the gymMachineId and the supplied request body', () => {
    const { mutate } = setupMutation();
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePromoteContribution('gm-1'), { wrapper: Wrapper });

    act(() => {
      result.current.handlePromote({ kind: 'existingTemplate', templateId: 't-1' });
    });

    expect(mutate).toHaveBeenCalledWith({
      id: 'gm-1',
      data: { kind: 'existingTemplate', templateId: 't-1' },
    });
  });

  it('shows the "promoted" toast and invalidates caches on a non-merge success', () => {
    const { getOptions } = setupMutation();
    const { Wrapper, client } = createQueryWrapper();
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');
    renderHook(() => usePromoteContribution('gm-1'), { wrapper: Wrapper });

    act(() => {
      getOptions()?.mutation?.onSuccess?.({ data: { mergedIntoGymMachineId: undefined } });
    });

    expect(burnt.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: '머신을 승격했어요', preset: 'done' }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: adminKeys.pendingContributions(),
    });
  });

  it('shows the "merged" toast when the response carries mergedIntoGymMachineId', () => {
    const { getOptions } = setupMutation();
    const { Wrapper } = createQueryWrapper();
    renderHook(() => usePromoteContribution('gm-1'), { wrapper: Wrapper });

    act(() => {
      getOptions()?.mutation?.onSuccess?.({ data: { mergedIntoGymMachineId: 'gm-existing' } });
    });

    expect(burnt.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: '기존 머신과 합쳤어요' }),
    );
  });

  it('treats a null mergedIntoGymMachineId (wire-level absent) as a non-merge promote', () => {
    const { getOptions } = setupMutation();
    const { Wrapper } = createQueryWrapper();
    renderHook(() => usePromoteContribution('gm-1'), { wrapper: Wrapper });

    // Jackson may emit `{"mergedIntoGymMachineId": null}` when the Java field
    // is null, even though the generated TS type is `?: string`. Cast through
    // unknown so the test exercises the wire shape, not the generated type.
    act(() => {
      const response = {
        data: { mergedIntoGymMachineId: null },
      } as unknown as { data: { mergedIntoGymMachineId?: string } };
      getOptions()?.mutation?.onSuccess?.(response);
    });

    expect(burnt.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: '머신을 승격했어요', preset: 'done' }),
    );
  });

  it('shows an error toast on failure', () => {
    const { getOptions } = setupMutation();
    const { Wrapper } = createQueryWrapper();
    renderHook(() => usePromoteContribution('gm-1'), { wrapper: Wrapper });

    act(() => {
      getOptions()?.mutation?.onError?.();
    });

    expect(burnt.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: '승격에 실패했어요', preset: 'error' }),
    );
  });
});
