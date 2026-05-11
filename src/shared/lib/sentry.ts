import * as Sentry from '@sentry/react-native';

// Empty / undefined DSN → init skipped entirely so dev environments emit zero Sentry traffic
// without manual setup. Mirrors the server-side SentryConfig contract.
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

let initialised = false;

export function initSentry(): void {
  // Empty DSN is the documented fail-open path (Task 31 #3). Re-entry guard prevents
  // Fast Refresh and accidental double-imports from re-initialising the client.
  if (initialised || !DSN) return;
  initialised = true;
  Sentry.init({
    dsn: DSN,
    environment: __DEV__ ? 'development' : 'production',
    enableNativeFramesTracking: !__DEV__,
    tracesSampleRate: __DEV__ ? 1.0 : 0.1,
  });
}

export function captureError(error: unknown, extra?: Record<string, unknown>): void {
  Sentry.captureException(error, extra ? { extra } : undefined);
}

// Wired into <ErrorBoundary onError={forwardRenderErrorToSentry}> at the app root. Exported
// as a named function so the test exercises the real callback identity and a future deletion
// of the prop in _layout.tsx is detectable.
export function forwardRenderErrorToSentry(
  error: Error,
  info: { componentStack?: string | null },
): void {
  Sentry.captureException(error, {
    contexts: { react: { componentStack: info.componentStack ?? '' } },
  });
}

export function setSentryUser(userId: string | null): void {
  Sentry.setUser(userId ? { id: userId } : null);
}
