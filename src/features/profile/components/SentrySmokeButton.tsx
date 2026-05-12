import { Pressable } from 'react-native';

import { AppText } from '@/shared/components/AppText';
import { captureError } from '@/shared/lib/sentry';

// Ops-only Sentry app verifier (Task 32b live smoke).
//
// Renders only when both:
//   1. The bundle is NOT a dev build (`__DEV__ === false`)
//   2. The smoke flag was set at build time (`process.env.EXPO_PUBLIC_SENTRY_SMOKE === 'true'`)
//
// Setting `EXPO_PUBLIC_SENTRY_SMOKE=true` is gated to the EAS preview-simulator profile
// (see `eas.json`), so a production App Store build will never render this control. Tapping
// it emits a hand-built `Error` through `captureError`, which is the same path the global
// error handler uses for unhandled exceptions — this lets us verify sourcemap symbolication
// end-to-end without crashing the smoke-build itself.
export function SentrySmokeButton() {
  // Evaluated per render (not module-level) so tests can flip `__DEV__` and the env flag
  // between cases without `jest.resetModules` (which corrupts the shared React instance
  // used by react-test-renderer).
  const shouldRender = !__DEV__ && process.env.EXPO_PUBLIC_SENTRY_SMOKE === 'true';
  if (!shouldRender) return null;

  function handlePress() {
    const error = new Error(`ironspot sentry smoke ${String(Date.now())}`);
    captureError(error);
  }

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel="Sentry smoke trigger (ops only)"
      className="mx-4 my-3 rounded-md border border-dashed border-text-tertiary p-3"
    >
      <AppText className="text-center text-body-sm text-text-tertiary">
        Sentry smoke test (ops only)
      </AppText>
    </Pressable>
  );
}
