import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as burnt from 'burnt';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Alert } from 'react-native';

import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { userKeys } from '@/features/auth/query-keys';
import { useDeleteMe, useUpdateMe } from '@/shared/generated/users/users';

import { AccountSettingsScreen } from '../AccountSettingsScreen';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn() },
}));
jest.mock('@/features/auth/hooks/useCurrentUser', () => ({
  useCurrentUser: jest.fn(),
}));
jest.mock('@/shared/generated/users/users', () => ({
  useUpdateMe: jest.fn(),
  useDeleteMe: jest.fn(),
}));
jest.mock('@/shared/lib/supabase', () => ({
  supabase: { auth: { signOut: jest.fn() } },
}));
jest.mock('burnt', () => ({
  toast: jest.fn(),
}));

const useCurrentUserMock = useCurrentUser as jest.Mock;
const useUpdateMeMock = useUpdateMe as jest.Mock;
const useDeleteMeMock = useDeleteMe as jest.Mock;
const routerReplaceMock = jest.mocked(router.replace);
const toastMock = burnt.toast as jest.Mock;

function getSupabaseSignOutMock(): jest.Mock {
  const mod = jest.requireMock<{ supabase: { auth: { signOut: jest.Mock } } }>(
    '@/shared/lib/supabase',
  );
  return mod.supabase.auth.signOut;
}

interface CapturedOptions {
  mutation?: {
    onSuccess?: (data?: unknown) => void | Promise<void>;
    onError?: (err: unknown) => void;
  };
}

interface MutationHandles {
  updateMutate: jest.Mock;
  deleteMutate: jest.Mock;
  getUpdateOptions: () => CapturedOptions | undefined;
  getDeleteOptions: () => CapturedOptions | undefined;
}

function setupMutations(): MutationHandles {
  const updateMutate = jest.fn();
  const deleteMutate = jest.fn();
  let updateCaptured: CapturedOptions | undefined;
  let deleteCaptured: CapturedOptions | undefined;

  useUpdateMeMock.mockImplementation((options: CapturedOptions) => {
    updateCaptured = options;
    return { mutate: updateMutate, isPending: false };
  });
  useDeleteMeMock.mockImplementation((options: CapturedOptions) => {
    deleteCaptured = options;
    return { mutate: deleteMutate, isPending: false };
  });

  return {
    updateMutate,
    deleteMutate,
    getUpdateOptions: () => updateCaptured,
    getDeleteOptions: () => deleteCaptured,
  };
}

function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { Wrapper, client };
}

beforeEach(() => {
  jest.clearAllMocks();
  useCurrentUserMock.mockReturnValue({
    data: {
      id: 'user-1',
      nickname: '테스트유저',
      email: 'me@example.com',
      createdAt: '2026-04-01T00:00:00Z',
    },
  });
  getSupabaseSignOutMock().mockResolvedValue({ error: null });
});

describe('AccountSettingsScreen', () => {
  it('renders nickname and email from useCurrentUser', () => {
    setupMutations();
    const { Wrapper } = createWrapper();
    render(<AccountSettingsScreen />, { wrapper: Wrapper });

    expect(screen.getByText('테스트유저')).toBeTruthy();
    expect(screen.getByText('me@example.com')).toBeTruthy();
  });

  it('pre-fills the input with the current nickname when 수정 is pressed', () => {
    setupMutations();
    const { Wrapper } = createWrapper();
    render(<AccountSettingsScreen />, { wrapper: Wrapper });

    fireEvent.press(screen.getByLabelText('닉네임 수정'));

    expect(screen.getByLabelText('닉네임 입력')).toHaveProp('value', '테스트유저');
  });

  it('shows error toast and skips mutation when trimmed nickname is shorter than 2', () => {
    const { updateMutate } = setupMutations();
    const { Wrapper } = createWrapper();
    render(<AccountSettingsScreen />, { wrapper: Wrapper });

    fireEvent.press(screen.getByLabelText('닉네임 수정'));
    fireEvent.changeText(screen.getByLabelText('닉네임 입력'), '  a  ');
    fireEvent.press(screen.getByText('저장'));

    expect(toastMock).toHaveBeenCalledWith({
      title: '닉네임은 2~20자여야 합니다',
      preset: 'error',
    });
    expect(updateMutate).not.toHaveBeenCalled();
  });

  it('calls useUpdateMe.mutate with trimmed nickname when length is valid', () => {
    const { updateMutate } = setupMutations();
    const { Wrapper } = createWrapper();
    render(<AccountSettingsScreen />, { wrapper: Wrapper });

    fireEvent.press(screen.getByLabelText('닉네임 수정'));
    fireEvent.changeText(screen.getByLabelText('닉네임 입력'), '  새닉네임  ');
    fireEvent.press(screen.getByText('저장'));

    expect(updateMutate).toHaveBeenCalledWith({ data: { nickname: '새닉네임' } });
  });

  it('invalidates the me query, exits edit mode, and toasts on update success', async () => {
    const handles = setupMutations();
    const { Wrapper, client } = createWrapper();
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');
    render(<AccountSettingsScreen />, { wrapper: Wrapper });

    fireEvent.press(screen.getByLabelText('닉네임 수정'));

    await act(async () => {
      await handles.getUpdateOptions()?.mutation?.onSuccess?.();
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: userKeys.all });
    expect(toastMock).toHaveBeenCalledWith({
      title: '닉네임이 변경되었습니다',
      preset: 'done',
    });
    expect(screen.queryByLabelText('닉네임 입력')).toBeNull();
  });

  it('toasts on update error', () => {
    const handles = setupMutations();
    const { Wrapper } = createWrapper();
    render(<AccountSettingsScreen />, { wrapper: Wrapper });

    handles.getUpdateOptions()?.mutation?.onError?.(new Error('boom'));

    expect(toastMock).toHaveBeenCalledWith({
      title: '변경에 실패했습니다',
      preset: 'error',
    });
  });

  it('opens Alert with cancel + destructive options when 계정 삭제 is pressed', () => {
    setupMutations();
    const { Wrapper } = createWrapper();
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    render(<AccountSettingsScreen />, { wrapper: Wrapper });

    fireEvent.press(screen.getByLabelText('계정 삭제'));

    expect(alertSpy).toHaveBeenCalledTimes(1);
    const buttons = alertSpy.mock.calls[0]?.[2];
    expect(buttons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: '취소', style: 'cancel' }),
        expect.objectContaining({ text: '삭제', style: 'destructive' }),
      ]),
    );
    alertSpy.mockRestore();
  });

  it('calls useDeleteMe.mutate when destructive confirm is selected', () => {
    const { deleteMutate } = setupMutations();
    const { Wrapper } = createWrapper();
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const destructive = buttons?.find((b) => b.style === 'destructive');
      destructive?.onPress?.();
    });
    render(<AccountSettingsScreen />, { wrapper: Wrapper });

    fireEvent.press(screen.getByLabelText('계정 삭제'));

    expect(deleteMutate).toHaveBeenCalledTimes(1);
    alertSpy.mockRestore();
  });

  it('signs out, clears cache, toasts, and navigates to login on delete success', async () => {
    const handles = setupMutations();
    const { Wrapper, client } = createWrapper();
    const clearSpy = jest.spyOn(client, 'clear');
    render(<AccountSettingsScreen />, { wrapper: Wrapper });

    await handles.getDeleteOptions()?.mutation?.onSuccess?.();

    expect(getSupabaseSignOutMock()).toHaveBeenCalledTimes(1);
    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(toastMock).toHaveBeenCalledWith({
      title: '계정이 삭제되었습니다',
      preset: 'done',
    });
    expect(routerReplaceMock).toHaveBeenCalledWith('/(auth)/login');
  });

  it('toasts on delete error', () => {
    const handles = setupMutations();
    const { Wrapper } = createWrapper();
    render(<AccountSettingsScreen />, { wrapper: Wrapper });

    handles.getDeleteOptions()?.mutation?.onError?.(new Error('boom'));

    expect(toastMock).toHaveBeenCalledWith({
      title: '삭제에 실패했습니다',
      preset: 'error',
    });
  });

  it('shows error toast and still clears cache + navigates when signOut fails', async () => {
    const handles = setupMutations();
    const { Wrapper, client } = createWrapper();
    const clearSpy = jest.spyOn(client, 'clear');
    getSupabaseSignOutMock().mockResolvedValueOnce({ error: new Error('boom') });
    render(<AccountSettingsScreen />, { wrapper: Wrapper });

    await handles.getDeleteOptions()?.mutation?.onSuccess?.();

    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(toastMock).toHaveBeenCalledWith({
      title: '삭제에 실패했습니다',
      preset: 'error',
    });
    expect(routerReplaceMock).toHaveBeenCalledWith('/(auth)/login');
  });

  it('skips mutate when save is submitted while an update is already in flight', () => {
    const updateMutate = jest.fn();
    const deleteMutate = jest.fn();
    useUpdateMeMock.mockReturnValue({ mutate: updateMutate, isPending: true });
    useDeleteMeMock.mockReturnValue({ mutate: deleteMutate, isPending: false });
    const { Wrapper } = createWrapper();
    render(<AccountSettingsScreen />, { wrapper: Wrapper });

    fireEvent.press(screen.getByLabelText('닉네임 수정'));
    fireEvent.changeText(screen.getByLabelText('닉네임 입력'), '새닉네임');
    fireEvent(screen.getByLabelText('닉네임 입력'), 'submitEditing');

    expect(updateMutate).not.toHaveBeenCalled();
  });
});
