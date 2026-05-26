import * as Sentry from '@sentry/react-native';

import { env } from './env';
import { scrubBreadcrumb, scrubErrorEvent } from './sentry-scrub';

// Security E6: DSN now flows through env.ts's Zod schema as an optional
// `z.string().url().optional()` field. Empty / undefined → init skipped
// (mirrors the server-side SentryConfig fail-open contract). Malformed
// URL fails at env.ts module load with a clear error rather than crashing
// Sentry.init at the first capture.
const DSN = env.EXPO_PUBLIC_SENTRY_DSN;

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
    // Security task #37: scrub Authorization headers, sensitive query-param values
    // (token, access_token, code, …), and user email/ip before events / breadcrumbs
    // leave the device. See sentry-scrub.ts for the redaction policy.
    beforeSend: scrubErrorEvent,
    beforeBreadcrumb: scrubBreadcrumb,
    // sendDefaultPii defaults to false on @sentry/react-native; making it explicit so a
    // future SDK default flip doesn't silently start sending IP / cookies.
    sendDefaultPii: false,
  });
}

// Single Sentry SDK call site for the app — every other helper in this file delegates here.
type CaptureContext = Parameters<typeof Sentry.captureException>[1];
export function captureError(error: unknown, context?: CaptureContext): void {
  Sentry.captureException(error, context);
}

// Wired into <ErrorBoundary onError={forwardRenderErrorToSentry}> at the app root. Exported
// as a named function so the unit test exercises the same callback identity that _layout.tsx
// uses (not a test-local lambda). Detecting accidental deletion of the prop in _layout.tsx
// remains an integration-level concern, not covered here.
export function forwardRenderErrorToSentry(
  error: Error,
  info: { componentStack?: string | null },
): void {
  captureError(error, {
    contexts: { react: { componentStack: info.componentStack ?? '' } },
  });
}

export function setSentryUser(userId: string | null): void {
  Sentry.setUser(userId ? { id: userId } : null);
}
