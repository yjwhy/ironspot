import { act, renderHook } from '@testing-library/react-native';
import * as burnt from 'burnt';
import { Alert } from 'react-native';

import { useReject } from '@/shared/generated/admin-contributions/admin-contributions';
import { captureMutation } from '@/test/utils/mutation-mock';
import { createQueryWrapper } from '@/test/utils/query-wrapper';

import { adminKeys } from '../../query-keys';
import { useRejectContribution } from '../useRejectContribution';

jest.mock('@/shared/generated/admin-contributions/admin-contributions', () => ({
  useReject: jest.fn(),
}));
jest.mock('burnt', () => ({ toast: jest.fn() }));

const useRejectMock = useReject as jest.Mock;

// Auto-confirm the Alert so confirmAndReject() exercises the mutate path.
interface AlertButton {
  text?: string;
  style?: string;
  onPress?: () => void;
}
jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
  const confirm = (buttons as AlertButton[] | undefined)?.find((b) => b.style === 'destructive');
  confirm?.onPress?.();
});

interface CapturedOptions {
  mutation?: {
    onSuccess?: () => void;
    onError?: () => void;
  };
}

function setupMutation() {
  return captureMutation<CapturedOptions>(useRejectMock);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useRejectContribution', () => {
  it('opens the destructive Alert and mutates with gymMachineId when confirmed', () => {
    const { mutate } = setupMutation();
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useRejectContribution('gm-1'), { wrapper: Wrapper });

    act(() => {
      result.current.confirmAndReject();
    });

    expect(Alert.alert).toHaveBeenCalled();
    expect(mutate).toHaveBeenCalledWith({ id: 'gm-1' });
  });

  it('shows a success toast and invalidates the pending contributions cache', () => {
    const { getOptions } = setupMutation();
    const { Wrapper, client } = createQueryWrapper();
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');
    renderHook(() => useRejectContribution('gm-1'), { wrapper: Wrapper });

    act(() => {
      getOptions()?.mutation?.onSuccess?.();
    });

    expect(burnt.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: '반려했어요', preset: 'done' }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: adminKeys.pendingContributions(),
    });
  });

  it('surfaces an error toast on failure', () => {
    const { getOptions } = setupMutation();
    const { Wrapper } = createQueryWrapper();
    renderHook(() => useRejectContribution('gm-1'), { wrapper: Wrapper });

    act(() => {
      getOptions()?.mutation?.onError?.();
    });

    expect(burnt.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: '반려에 실패했어요', preset: 'error' }),
    );
  });
});
