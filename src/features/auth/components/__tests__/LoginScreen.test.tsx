import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { AUTH_REDIRECT_URL } from '../../constants';
import { LoginScreen } from '../LoginScreen';

function setPlatform(os: typeof Platform.OS) {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true, writable: true });
}

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

const originalPlatformOS = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  getSupabaseMock().auth.signInWithOAuth.mockResolvedValue({ error: null });
  setPlatform('ios');
});

afterEach(() => {
  setPlatform(originalPlatformOS);
});

describe('LoginScreen', () => {
  it('renders Google and Kakao login buttons', () => {
    const { getByRole } = render(<LoginScreen onBrowseAsGuest={() => undefined} />);
    expect(getByRole('button', { name: 'Google로 계속하기' })).toBeTruthy();
    expect(getByRole('button', { name: 'Kakao로 계속하기' })).toBeTruthy();
  });

  it('renders Apple login button on iOS', () => {
    const { getByRole } = render(<LoginScreen onBrowseAsGuest={() => undefined} />);
    expect(getByRole('button', { name: 'Apple로 계속하기' })).toBeTruthy();
  });

  it('does not render Apple login button on Android', () => {
    setPlatform('android');
    const { queryByRole } = render(<LoginScreen onBrowseAsGuest={() => undefined} />);
    expect(queryByRole('button', { name: 'Apple로 계속하기' })).toBeNull();
  });

  it('calls signInWithOAuth with apple provider when Apple button is pressed', async () => {
    const { getByRole } = render(<LoginScreen onBrowseAsGuest={() => undefined} />);
    act(() => {
      fireEvent.press(getByRole('button', { name: 'Apple로 계속하기' }));
    });
    await waitFor(() => {
      expect(getSupabaseMock().auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'apple',
        options: { redirectTo: AUTH_REDIRECT_URL },
      });
    });
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
