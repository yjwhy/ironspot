import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { AUTH_REDIRECT_URL } from '../../constants';
import { LoginScreen } from '../LoginScreen';

jest.mock('@/shared/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOAuth: jest.fn().mockResolvedValue({ error: null }),
    },
  },
}));

jest.mock('burnt', () => ({
  toast: jest.fn(),
}));

function getSupabaseMock() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { supabase } = require('@/shared/lib/supabase') as {
    supabase: { auth: { signInWithOAuth: jest.Mock } };
  };
  return supabase;
}

function getBurntMock() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('burnt') as { toast: jest.Mock };
}

beforeEach(() => {
  jest.clearAllMocks();
  getSupabaseMock().auth.signInWithOAuth.mockResolvedValue({ error: null });
});

describe('LoginScreen', () => {
  it('renders Google and Kakao login buttons', () => {
    const { getByRole } = render(<LoginScreen onBrowseAsGuest={() => undefined} />);
    expect(getByRole('button', { name: 'Google로 계속하기' })).toBeTruthy();
    expect(getByRole('button', { name: 'Kakao로 계속하기' })).toBeTruthy();
  });

  it('renders "로그인 없이 둘러보기" button', () => {
    const { getByRole } = render(<LoginScreen onBrowseAsGuest={() => undefined} />);
    expect(getByRole('button', { name: '로그인 없이 둘러보기' })).toBeTruthy();
  });

  it('calls onBrowseAsGuest when the guest button is pressed', () => {
    const onBrowseAsGuest = jest.fn();
    const { getByRole } = render(<LoginScreen onBrowseAsGuest={onBrowseAsGuest} />);
    fireEvent.press(getByRole('button', { name: '로그인 없이 둘러보기' }));
    expect(onBrowseAsGuest).toHaveBeenCalledTimes(1);
  });

  it('calls signInWithOAuth with google provider when Google button is pressed', async () => {
    const { getByRole } = render(<LoginScreen onBrowseAsGuest={() => undefined} />);
    act(() => {
      fireEvent.press(getByRole('button', { name: 'Google로 계속하기' }));
    });
    await waitFor(() => {
      expect(getSupabaseMock().auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: { redirectTo: AUTH_REDIRECT_URL },
      });
    });
  });

  it('calls signInWithOAuth with kakao provider when Kakao button is pressed', async () => {
    const { getByRole } = render(<LoginScreen onBrowseAsGuest={() => undefined} />);
    act(() => {
      fireEvent.press(getByRole('button', { name: 'Kakao로 계속하기' }));
    });
    await waitFor(() => {
      expect(getSupabaseMock().auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'kakao',
        options: { redirectTo: AUTH_REDIRECT_URL },
      });
    });
  });

  it('shows error toast when signInWithOAuth returns an error', async () => {
    getSupabaseMock().auth.signInWithOAuth.mockResolvedValueOnce({
      error: new Error('OAuth failed'),
    });
    const { getByRole } = render(<LoginScreen onBrowseAsGuest={() => undefined} />);
    act(() => {
      fireEvent.press(getByRole('button', { name: 'Google로 계속하기' }));
    });
    await waitFor(() => {
      expect(getBurntMock().toast).toHaveBeenCalledWith({
        title: '로그인에 실패했습니다',
        preset: 'error',
      });
    });
  });
});
