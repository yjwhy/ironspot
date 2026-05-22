import { useEffect } from 'react';

import { API_URL } from '../lib/api-base-url';

// Render free-tier instances spin down after ~15 min of inactivity and the
// first request afterwards eats a 50s+ cold-boot. UptimeRobot's 5-min ping
// covers most of that window but Render still occasionally restarts free
// containers (weekly forced restart, internal redeploys, etc.) and the next
// real user lands on the cold-boot.
//
// This hook fires a single fire-and-forget GET to /actuator/health on mount
// so the BE warms up while the user is still navigating to the first screen
// that actually needs it (camera, OCR upload). The ping is short-timed and
// AbortController-cancelled on unmount so it never pins React state, blocks
// the bridge, or leaks an in-flight request across re-mounts.
//
// Side-effects, not return value: this is intentionally a void hook. Status
// would invite callers to gate UI on the ping, which would defeat the
// "user never sees cold-boot" goal.
const KEEP_WARM_TIMEOUT_MS = 8_000;
const HEALTH_PATH = '/actuator/health';

export function useKeepBackendWarm(): void {
  useEffect(function pingHealthOnMount() {
    const controller = new AbortController();
    const timer = setTimeout(function timeoutAbort() {
      controller.abort();
    }, KEEP_WARM_TIMEOUT_MS);

    fetch(`${API_URL}${HEALTH_PATH}`, {
      method: 'GET',
      signal: controller.signal,
    })
      .catch(function swallow() {
        // Keep-warm is best-effort. A failed ping has no UX consequence —
        // the next real request retries through the normal apiClient path.
      })
      .finally(function clear() {
        clearTimeout(timer);
      });

    return function cancelOnUnmount() {
      clearTimeout(timer);
      controller.abort();
    };
  }, []);
}
