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
      signInWithIdToken: jest.fn(),
      exchangeCodeForSession: jest.fn(),
      setSession: jest.fn(),
      updateUser: jest.fn(),
    },
  },
}));

jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(),
}));

jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(),
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 'fullName', EMAIL: 'email' },
}));

jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn(),
  digestStringAsync: jest.fn(),
  CryptoDigestAlgorithm: { SHA256: 'SHA256' },
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
        signInWithIdToken: jest.Mock;
        exchangeCodeForSession: jest.Mock;
        setSession: jest.Mock;
        updateUser: jest.Mock;
      };
    };
  };
  return supabase;
}

function getAppleAuthMock() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-apple-authentication') as {
    isAvailableAsync: jest.Mock;
    signInAsync: jest.Mock;
  };
}

function getCryptoMock() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-crypto') as {
    getRandomBytesAsync: jest.Mock;
    digestStringAsync: jest.Mock;
  };
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
  getSupabaseMock().auth.signInWithIdToken.mockResolvedValue({
    data: { session: null },
    error: null,
  });
  getSupabaseMock().auth.exchangeCodeForSession.mockResolvedValue({ error: null });
  getSupabaseMock().auth.setSession.mockResolvedValue({ error: null });
  getSupabaseMock().auth.updateUser.mockResolvedValue({ data: { user: null }, error: null });
  getWebBrowserMock().openAuthSessionAsync.mockResolvedValue({
    type: 'success',
    url: PKCE_CALLBACK_URL,
  });
  // Default: native Apple Sign In unavailable (simulator/jest env). Tests that need
  // native flow override this with mockResolvedValueOnce(true) before rendering.
  getAppleAuthMock().isAvailableAsync.mockResolvedValue(false);
  getCryptoMock().getRandomBytesAsync.mockResolvedValue(new Uint8Array(16));
  getCryptoMock().digestStringAsync.mockResolvedValue('mock-sha256-hash');
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

describe('LoginScreen — native Apple Sign In (Task 48 / ADR 0024)', () => {
  function arrangeNativeAvailable() {
    getAppleAuthMock().isAvailableAsync.mockResolvedValue(true);
  }

  function makeCredential(
    overrides: Partial<{
      identityToken: string | null;
      fullName: { givenName: string | null; familyName: string | null } | null;
    }> = {},
  ) {
    return {
      identityToken: 'mock-identity-token',
      authorizationCode: 'mock-auth-code',
      user: 'apple-user-id',
      email: 'user@privaterelay.appleid.com',
      fullName: { givenName: null, familyName: null },
      realUserStatus: 1,
      state: null,
      ...overrides,
    };
  }

  it('calls signInWithIdToken with the raw nonce when native is available', async () => {
    arrangeNativeAvailable();
    getAppleAuthMock().signInAsync.mockResolvedValueOnce(makeCredential());

    const { onAuthenticated, getByRole, findByRole } = renderLoginScreen();
    // wait for useEffect to flip appleNativeAvailable
    await findByRole('button', { name: 'Apple로 계속하기' });
    act(() => {
      fireEvent.press(getByRole('button', { name: 'Apple로 계속하기' }));
    });
    await waitFor(() => {
      expect(getAppleAuthMock().signInAsync).toHaveBeenCalledTimes(1);
    });
    expect(getAppleAuthMock().signInAsync).toHaveBeenCalledWith(
      expect.objectContaining({ nonce: 'mock-sha256-hash' }),
    );
    await waitFor(() => {
      expect(getSupabaseMock().auth.signInWithIdToken).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'apple',
          token: 'mock-identity-token',
          // raw nonce (hex of 16 zero bytes) goes to Supabase; hashed went to Apple
          nonce: '00000000000000000000000000000000',
        }),
      );
    });
    await waitFor(() => {
      expect(onAuthenticated).toHaveBeenCalledTimes(1);
    });
    // No web browser opened on native path
    expect(getWebBrowserMock().openAuthSessionAsync).not.toHaveBeenCalled();
  });

  it('persists fullName to user_metadata on first sign-in', async () => {
    arrangeNativeAvailable();
    getAppleAuthMock().signInAsync.mockResolvedValueOnce(
      makeCredential({ fullName: { givenName: '길동', familyName: '홍' } }),
    );

    const { getByRole, findByRole } = renderLoginScreen();
    await findByRole('button', { name: 'Apple로 계속하기' });
    act(() => {
      fireEvent.press(getByRole('button', { name: 'Apple로 계속하기' }));
    });
    await waitFor(() => {
      expect(getSupabaseMock().auth.updateUser).toHaveBeenCalledWith({
        data: { full_name: '길동 홍' },
      });
    });
  });

  it('skips updateUser on subsequent sign-in when fullName is empty', async () => {
    arrangeNativeAvailable();
    getAppleAuthMock().signInAsync.mockResolvedValueOnce(makeCredential());

    const { getByRole, findByRole } = renderLoginScreen();
    await findByRole('button', { name: 'Apple로 계속하기' });
    act(() => {
      fireEvent.press(getByRole('button', { name: 'Apple로 계속하기' }));
    });
    await waitFor(() => {
      expect(getSupabaseMock().auth.signInWithIdToken).toHaveBeenCalledTimes(1);
    });
    expect(getSupabaseMock().auth.updateUser).not.toHaveBeenCalled();
  });

  it('stays silent on user cancel (ERR_REQUEST_CANCELED)', async () => {
    arrangeNativeAvailable();
    const cancelError: Error & { code?: string } = new Error('user canceled');
    cancelError.code = 'ERR_REQUEST_CANCELED';
    getAppleAuthMock().signInAsync.mockRejectedValueOnce(cancelError);

    const { onAuthenticated, getByRole, findByRole } = renderLoginScreen();
    await findByRole('button', { name: 'Apple로 계속하기' });
    act(() => {
      fireEvent.press(getByRole('button', { name: 'Apple로 계속하기' }));
    });
    await waitFor(() => {
      expect(getAppleAuthMock().signInAsync).toHaveBeenCalledTimes(1);
    });
    expect(getBurntMock().toast).not.toHaveBeenCalled();
    expect(getSentryMock().captureError).not.toHaveBeenCalled();
    expect(onAuthenticated).not.toHaveBeenCalled();
  });

  it('shows error toast + Sentry when native sign-in throws a non-cancel error', async () => {
    arrangeNativeAvailable();
    const nativeError = new Error('apple boom');
    getAppleAuthMock().signInAsync.mockRejectedValueOnce(nativeError);

    const { onAuthenticated, getByRole, findByRole } = renderLoginScreen();
    await findByRole('button', { name: 'Apple로 계속하기' });
    act(() => {
      fireEvent.press(getByRole('button', { name: 'Apple로 계속하기' }));
    });
    await waitFor(() => {
      expect(getBurntMock().toast).toHaveBeenCalledWith({
        title: '로그인에 실패했습니다',
        preset: 'error',
      });
    });
    expect(getSentryMock().captureError).toHaveBeenCalledWith(nativeError);
    expect(onAuthenticated).not.toHaveBeenCalled();
  });

  it('falls back to web OAuth when isAvailableAsync returns false', async () => {
    // default beforeEach sets isAvailableAsync = false
    const { getByRole } = renderLoginScreen();
    act(() => {
      fireEvent.press(getByRole('button', { name: 'Apple로 계속하기' }));
    });
    await waitFor(() => {
      expect(getSupabaseMock().auth.signInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'apple' }),
      );
    });
    expect(getAppleAuthMock().signInAsync).not.toHaveBeenCalled();
  });
});
