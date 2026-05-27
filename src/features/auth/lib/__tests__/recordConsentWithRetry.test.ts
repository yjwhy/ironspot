import { recordConsentWithRetry } from '../recordConsentWithRetry';

describe('recordConsentWithRetry', () => {
  it('returns true on first success without retrying', async () => {
    const write = jest.fn().mockResolvedValue(undefined);

    const ok = await recordConsentWithRetry(write, { attempts: 3, delayMs: 0 });

    expect(ok).toBe(true);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('retries and succeeds on a later attempt', async () => {
    const write = jest
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue(undefined);

    const ok = await recordConsentWithRetry(write, { attempts: 3, delayMs: 0 });

    expect(ok).toBe(true);
    expect(write).toHaveBeenCalledTimes(3);
  });

  it('returns false after exhausting all attempts', async () => {
    const write = jest.fn().mockRejectedValue(new Error('down'));

    const ok = await recordConsentWithRetry(write, { attempts: 3, delayMs: 0 });

    expect(ok).toBe(false);
    expect(write).toHaveBeenCalledTimes(3);
  });

  it('does not swallow a thrown non-Error rejection into success', async () => {
    const write = jest.fn().mockRejectedValue('string failure');

    const ok = await recordConsentWithRetry(write, { attempts: 2, delayMs: 0 });

    expect(ok).toBe(false);
    expect(write).toHaveBeenCalledTimes(2);
  });
});
