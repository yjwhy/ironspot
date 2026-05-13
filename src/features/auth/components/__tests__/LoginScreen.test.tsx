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
      signInWithOAuth: jest.fn(),
      exchangeCodeForSession: jest.fn(),
      setSession: jest.fn(),
    },
  },
}));

jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(),
}));

jest.mock('burnt', () => ({
  toast: jest.fn(),
}));

jest.mock('@/shared/lib/sentry', () => ({
  captureError: jest.fn(),
}));

const OAUTH_URL = 'https://example.supabase.co/auth/v1/authorize?provider=google';
const PKCE_CALLBACK_URL = 'ironspot://auth/callback?code=abc123';
const IMPLICIT_CALLBACK_URL =
  'ironspot://auth/callback#access_token=AAA&refresh_token=BBB&token_type=bearer';

function getSupabaseMock() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { supabase } = require('@/shared/lib/supabase') as {
    supabase: {
      auth: {
        signInWithOAuth: jest.Mock;
        exchangeCodeForSession: jest.Mock;
        setSession: jest.Mock;
      };
    };
  };
  return supabase;
}

function getWebBrowserMock() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-web-browser') as { openAuthSessionAsync: jest.Mock };
}

function getBurntMock() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('burnt') as { toast: jest.Mock };
}

function getSentryMock() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@/shared/lib/sentry') as { captureError: jest.Mock };
}

const originalPlatformOS = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  getSupabaseMock().auth.signInWithOAuth.mockResolvedValue({
    data: { url: OAUTH_URL },
    error: null,
  });
  getSupabaseMock().auth.exchangeCodeForSession.mockResolvedValue({ error: null });
  getSupabaseMock().auth.setSession.mockResolvedValue({ error: null });
  getWebBrowserMock().openAuthSessionAsync.mockResolvedValue({
    type: 'success',
    url: PKCE_CALLBACK_URL,
  });
  setPlatform('ios');
});

afterEach(() => {
  setPlatform(originalPlatformOS);
});

function renderLoginScreen({ onBrowseAsGuest = jest.fn(), onAuthenticated = jest.fn() } = {}) {
  return {
    onBrowseAsGuest,
    onAuthenticated,
    ...render(<LoginScreen onBrowseAsGuest={onBrowseAsGuest} onAuthenticated={onAuthenticated} />),
  };
}

describe('LoginScreen — rendering', () => {
  it('renders Google and Kakao login buttons', () => {
    const { getByRole } = renderLoginScreen();
    expect(getByRole('button', { name: 'Google로 계속하기' })).toBeTruthy();
    expect(getByRole('button', { name: 'Kakao로 계속하기' })).toBeTruthy();
  });

  it('renders Apple login button on iOS', () => {
    const { getByRole } = renderLoginScreen();
    expect(getByRole('button', { name: 'Apple로 계속하기' })).toBeTruthy();
  });

  it('does not render Apple login button on Android', () => {
    setPlatform('android');
    const { queryByRole } = renderLoginScreen();
    expect(queryByRole('button', { name: 'Apple로 계속하기' })).toBeNull();
  });

  it('renders "로그인 없이 둘러보기" button', () => {
    const { getByRole } = renderLoginScreen();
    expect(getByRole('button', { name: '로그인 없이 둘러보기' })).toBeTruthy();
  });

  it('calls onBrowseAsGuest when the guest button is pressed', () => {
    const { onBrowseAsGuest, getByRole } = renderLoginScreen();
    fireEvent.press(getByRole('button', { name: '로그인 없이 둘러보기' }));
    expect(onBrowseAsGuest).toHaveBeenCalledTimes(1);
  });
});

describe('LoginScreen — OAuth flow', () => {
  it('calls signInWithOAuth with skipBrowserRedirect when a provider button is pressed', async () => {
    const { getByRole } = renderLoginScreen();
    act(() => {
      fireEvent.press(getByRole('button', { name: 'Google로 계속하기' }));
    });
    await waitFor(() => {
      expect(getSupabaseMock().auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: { redirectTo: AUTH_REDIRECT_URL, skipBrowserRedirect: true },
      });
    });
  });

  it.each(['google', 'kakao', 'apple'] as const)(
    'opens WebBrowser with the OAuth URL for %s',
    async (provider) => {
      const label =
        provider === 'google'
          ? 'Google로 계속하기'
          : provider === 'kakao'
            ? 'Kakao로 계속하기'
            : 'Apple로 계속하기';
      const { getByRole } = renderLoginScreen();
      act(() => {
        fireEvent.press(getByRole('button', { name: label }));
      });
      await waitFor(() => {
        expect(getWebBrowserMock().openAuthSessionAsync).toHaveBeenCalledWith(
          OAUTH_URL,
          AUTH_REDIRECT_URL,
        );
      });
    },
  );

  it('exchanges the PKCE code for a session on success', async () => {
    const { onAuthenticated, getByRole } = renderLoginScreen();
    act(() => {
      fireEvent.press(getByRole('button', { name: 'Google로 계속하기' }));
    });
    await waitFor(() => {
      expect(getSupabaseMock().auth.exchangeCodeForSession).toHaveBeenCalledWith('abc123');
    });
    await waitFor(() => {
      expect(onAuthenticated).toHaveBeenCalledTimes(1);
    });
  });

  it('falls back to setSession when the callback carries access/refresh tokens (implicit flow)', async () => {
    getWebBrowserMock().openAuthSessionAsync.mockResolvedValueOnce({
      type: 'success',
      url: IMPLICIT_CALLBACK_URL,
    });
    const { onAuthenticated, getByRole } = renderLoginScreen();
    act(() => {
      fireEvent.press(getByRole('button', { name: 'Google로 계속하기' }));
    });
    await waitFor(() => {
      expect(getSupabaseMock().auth.setSession).toHaveBeenCalledWith({
        access_token: 'AAA',
        refresh_token: 'BBB',
      });
    });
    await waitFor(() => {
      expect(onAuthenticated).toHaveBeenCalledTimes(1);
    });
  });

  it('stays silent (no toast, no auth) when the user cancels the WebBrowser', async () => {
    getWebBrowserMock().openAuthSessionAsync.mockResolvedValueOnce({ type: 'cancel' });
    const { onAuthenticated, getByRole } = renderLoginScreen();
    act(() => {
      fireEvent.press(getByRole('button', { name: 'Google로 계속하기' }));
    });
    await waitFor(() => {
      expect(getWebBrowserMock().openAuthSessionAsync).toHaveBeenCalledTimes(1);
    });
    expect(getSupabaseMock().auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(getSupabaseMock().auth.setSession).not.toHaveBeenCalled();
    expect(onAuthenticated).not.toHaveBeenCalled();
    expect(getBurntMock().toast).not.toHaveBeenCalled();
  });

  it('shows an error toast when the OAuth URL is missing', async () => {
    getSupabaseMock().auth.signInWithOAuth.mockResolvedValueOnce({
      data: { url: null },
      error: null,
    });
    const { getByRole } = renderLoginScreen();
    act(() => {
      fireEvent.press(getByRole('button', { name: 'Google로 계속하기' }));
    });
    await waitFor(() => {
      expect(getBurntMock().toast).toHaveBeenCalledWith({
        title: '로그인에 실패했습니다',
        preset: 'error',
      });
    });
    expect(getWebBrowserMock().openAuthSessionAsync).not.toHaveBeenCalled();
  });

  it('shows an error toast when the callback URL carries neither code nor tokens', async () => {
    getWebBrowserMock().openAuthSessionAsync.mockResolvedValueOnce({
      type: 'success',
      url: 'ironspot://auth/callback?error=access_denied',
    });
    const { onAuthenticated, getByRole } = renderLoginScreen();
    act(() => {
      fireEvent.press(getByRole('button', { name: 'Google로 계속하기' }));
    });
    await waitFor(() => {
      expect(getBurntMock().toast).toHaveBeenCalledWith({
        title: '로그인에 실패했습니다',
        preset: 'error',
      });
    });
    expect(onAuthenticated).not.toHaveBeenCalled();
  });

  it('shows an error toast when exchangeCodeForSession fails', async () => {
    getSupabaseMock().auth.exchangeCodeForSession.mockResolvedValueOnce({
      error: new Error('exchange failed'),
    });
    const { onAuthenticated, getByRole } = renderLoginScreen();
    act(() => {
      fireEvent.press(getByRole('button', { name: 'Google로 계속하기' }));
    });
    await waitFor(() => {
      expect(getBurntMock().toast).toHaveBeenCalledWith({
        title: '로그인에 실패했습니다',
        preset: 'error',
      });
    });
    expect(onAuthenticated).not.toHaveBeenCalled();
  });

  it('shows an error toast when signInWithOAuth returns an error', async () => {
    const oauthError = new Error('OAuth failed');
    getSupabaseMock().auth.signInWithOAuth.mockResolvedValueOnce({
      data: { url: null },
      error: oauthError,
    });
    const { getByRole } = renderLoginScreen();
    act(() => {
      fireEvent.press(getByRole('button', { name: 'Google로 계속하기' }));
    });
    await waitFor(() => {
      expect(getBurntMock().toast).toHaveBeenCalledWith({
        title: '로그인에 실패했습니다',
        preset: 'error',
      });
    });
    expect(getWebBrowserMock().openAuthSessionAsync).not.toHaveBeenCalled();
    expect(getSentryMock().captureError).toHaveBeenCalledWith(oauthError);
  });
});
