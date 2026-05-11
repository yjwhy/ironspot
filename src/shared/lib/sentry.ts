import * as Sentry from '@sentry/react-native';

// Empty / undefined DSN → init skipped entirely so dev environments emit zero Sentry traffic
// without manual setup. Mirrors the server-side SentryConfig contract. Kept out of env.ts's
// Zod schema because that schema throws at module load for missing required vars — DSN is
// optional by design (fail-open) and must not gate app boot.
//
// Read as `unknown` then narrowed: in CI the gitignored expo-env.d.ts is absent so
// process.env.X resolves to `any`. Assigning `any → unknown` is safe (no-unsafe-assignment
// rule treats `unknown` as the safe sink) and the typeof guard then narrows to string.
// A bare `as string | undefined` cast would also work in CI but `eslint --fix` strips it
// locally as "unnecessary" thanks to expo-env.d.ts, undoing the fix on every pre-commit.
const rawDSN: unknown = process.env.EXPO_PUBLIC_SENTRY_DSN;
const DSN = typeof rawDSN === 'string' && rawDSN.length > 0 ? rawDSN : undefined;

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
