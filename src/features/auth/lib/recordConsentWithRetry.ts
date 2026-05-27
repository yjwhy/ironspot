interface RetryOptions {
  /** Total attempts including the first. Default 3. */
  attempts?: number;
  /** Base backoff between attempts in ms (multiplied by attempt number). Default 400. */
  delayMs?: number;
}

const DEFAULT_ATTEMPTS = 3;
const DEFAULT_DELAY_MS = 400;

function delay(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Security I2 (PIPA Article 22): the user actively consents at the LoginScreen
 * gate BEFORE any OAuth runs, but the audit-trail write (POST /me/consent) can
 * only happen after the session exists (the endpoint is authenticated). A
 * single best-effort write that silently failed could leave a session with no
 * recorded consent. This retries the write with linear backoff so a transient
 * backend blip no longer drops the legally-required record.
 *
 * Returns true once the write succeeds, false if every attempt failed. The
 * caller decides what a final failure means (we refuse to grant access rather
 * than process data with no consent record on file).
 */
export async function recordConsentWithRetry(
  write: () => Promise<unknown>,
  options: RetryOptions = {},
): Promise<boolean> {
  const attempts = options.attempts ?? DEFAULT_ATTEMPTS;
  const delayMs = options.delayMs ?? DEFAULT_DELAY_MS;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await write();
      return true;
    } catch {
      if (attempt < attempts) {
        await delay(delayMs * attempt);
      }
    }
  }
  return false;
}
