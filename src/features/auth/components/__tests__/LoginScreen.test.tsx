import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { createQueryWrapper } from '@/test/utils/query-wrapper';

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
      signOut: jest.fn(),
    },
  },
}));

// Security I2: LoginScreen records PIPA consent (with retry) before granting
// access. Mock the generated hook so consent resolves/rejects deterministically
// instead of hitting the network — otherwise the retry would run real backoff
// delays and leak timers across tests.
jest.mock('@/shared/generated/users/users', () => ({
  useRecordConsent: jest.fn(),
}));

jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(),
  openBrowserAsync: jest.fn().mockResolvedValue({ type: 'opened' }),
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
        signOut: jest.Mock;
      };
    };
  };
  return supabase;
}

const recordConsentMock = jest.fn();

function getUseRecordConsentMock() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@/shared/generated/users/users') as { useRecordConsent: jest.Mock };
}

function getWebBrowserMock() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-web-browser') as {
    openAuthSessionAsync: jest.Mock;
    openBrowserAsync: jest.Mock;
  };
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
  getSupabaseMock().auth.signOut.mockResolvedValue({ error: null });
  recordConsentMock.mockResolvedValue(undefined);
  getUseRecordConsentMock().useRecordConsent.mockReturnValue({ mutateAsync: recordConsentMock });
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
  // Security task #17: LoginScreen now mounts the orval-generated
  // useRecordConsent hook which requires a QueryClientProvider in the
  // tree. Wrap each render in a fresh client so concurrent tests don't
  // share mutation cache.
  const { Wrapper } = createQueryWrapper();
  return {
    onBrowseAsGuest,
    onAuthenticated,
    ...render(
      <Wrapper>
        <LoginScreen onBrowseAsGuest={onBrowseAsGuest} onAuthenticated={onAuthenticated} />
      </Wrapper>,
    ),
  };
}

function tapConsentCheckbox(
  getByTestId: (
    id: string,
  ) => ReturnType<typeof renderLoginScreen>['getByTestId'] extends (id: string) => infer R
    ? R
    : never,
) {
  // Security task #17: every OAuth-driven test path needs the consent
  // checkbox ticked first or the OAuth button stays disabled. Wrapped
  // in act() because the toggle triggers a state update.
  act(() => {
    fireEvent.press(getByTestId('login-consent-checkbox'));
  });
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

  it('opens the privacy policy URL in an in-app browser when 개인정보처리방침 link is pressed', () => {
    const { getByLabelText } = renderLoginScreen();
    fireEvent.press(getByLabelText('개인정보처리방침 열기'));
    expect(getWebBrowserMock().openBrowserAsync).toHaveBeenCalledWith(
      'https://yjwhy.github.io/ironspot/privacy-policy.ko.html',
    );
  });

  it('opens the terms of service URL in an in-app browser when 이용약관 link is pressed', () => {
    const { getByLabelText } = renderLoginScreen();
    fireEvent.press(getByLabelText('이용약관 열기'));
    expect(getWebBrowserMock().openBrowserAsync).toHaveBeenCalledWith(
      'https://yjwhy.github.io/ironspot/terms-of-service.ko.html',
    );
  });
});

describe('LoginScreen — OAuth flow', () => {
  it('calls signInWithOAuth with skipBrowserRedirect when a provider button is pressed', async () => {
    const { getByRole, getByTestId } = renderLoginScreen();
    tapConsentCheckbox(getByTestId);
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
      const { getByRole, getByTestId } = renderLoginScreen();
      tapConsentCheckbox(getByTestId);
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
    const { onAuthenticated, getByRole, getByTestId } = renderLoginScreen();
    tapConsentCheckbox(getByTestId);
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

  it('records PIPA consent before granting access (security I2)', async () => {
    const { onAuthenticated, getByRole, getByTestId } = renderLoginScreen();
    tapConsentCheckbox(getByTestId);
    act(() => {
      fireEvent.press(getByRole('button', { name: 'Google로 계속하기' }));
    });
    await waitFor(() => {
      expect(recordConsentMock).toHaveBeenCalledWith({ data: { version: 'v1' } });
    });
    await waitFor(() => {
      expect(onAuthenticated).toHaveBeenCalledTimes(1);
    });
  });

  it('signs out and does not grant access when consent recording fails (security I2)', async () => {
    recordConsentMock.mockRejectedValue(new Error('consent endpoint down'));
    const { onAuthenticated, getByRole, getByTestId } = renderLoginScreen();
    tapConsentCheckbox(getByTestId);
    act(() => {
      fireEvent.press(getByRole('button', { name: 'Google로 계속하기' }));
    });

    await waitFor(
      () => {
        expect(getSupabaseMock().auth.signOut).toHaveBeenCalledTimes(1);
      },
      { timeout: 3000 },
    );
    expect(onAuthenticated).not.toHaveBeenCalled();
    expect(getBurntMock().toast).toHaveBeenCalledWith(expect.objectContaining({ preset: 'error' }));
  });

  it('rejects implicit-flow callbacks as a custom-scheme hijack vector (security #16)', async () => {
    getWebBrowserMock().openAuthSessionAsync.mockResolvedValueOnce({
      type: 'success',
      url: IMPLICIT_CALLBACK_URL,
    });
    const { onAuthenticated, getByRole, getByTestId } = renderLoginScreen();
    tapConsentCheckbox(getByTestId);
    act(() => {
      fireEvent.press(getByRole('button', { name: 'Google로 계속하기' }));
    });
    await waitFor(() => {
      expect(getBurntMock().toast).toHaveBeenCalledWith(
        expect.objectContaining({ preset: 'error' }),
      );
    });
    expect(getSupabaseMock().auth.setSession).not.toHaveBeenCalled();
    expect(getSupabaseMock().auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(onAuthenticated).not.toHaveBeenCalled();
  });

  it('stays silent (no toast, no auth) when the user cancels the WebBrowser', async () => {
    getWebBrowserMock().openAuthSessionAsync.mockResolvedValueOnce({ type: 'cancel' });
    const { onAuthenticated, getByRole, getByTestId } = renderLoginScreen();
    tapConsentCheckbox(getByTestId);
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
    const { getByRole, getByTestId } = renderLoginScreen();
    tapConsentCheckbox(getByTestId);
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
    const { onAuthenticated, getByRole, getByTestId } = renderLoginScreen();
    tapConsentCheckbox(getByTestId);
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
    const { onAuthenticated, getByRole, getByTestId } = renderLoginScreen();
    tapConsentCheckbox(getByTestId);
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
    const { getByRole, getByTestId } = renderLoginScreen();
    tapConsentCheckbox(getByTestId);
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
