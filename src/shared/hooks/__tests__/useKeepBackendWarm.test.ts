import { renderHook } from '@testing-library/react-native';

import { useKeepBackendWarm } from '../useKeepBackendWarm';

interface FetchStub {
  installPending: () => void;
  installRejecting: (error: Error) => void;
  callCount: () => number;
  lastCall: () => { url: string; signal: AbortSignal | undefined; method: string | undefined };
}

function createFetchStub(): FetchStub {
  let calls = 0;
  let lastUrl = '';
  let lastSignal: AbortSignal | undefined;
  let lastMethod: string | undefined;

  function record(input: RequestInfo | URL, init?: RequestInit): void {
    calls += 1;
    if (typeof input === 'string') {
      lastUrl = input;
    } else if (input instanceof URL) {
      lastUrl = input.href;
    } else {
      lastUrl = input.url;
    }
    lastSignal = init?.signal ?? undefined;
    lastMethod = init?.method;
  }

  return {
    installPending() {
      global.fetch = function pending(input: RequestInfo | URL, init?: RequestInit) {
        record(input, init);
        return new Promise<Response>(function neverResolves() {
          // hook is fire-and-forget — never resolving exposes the abort path
        });
      };
    },
    installRejecting(error: Error) {
      global.fetch = function rejecting(input: RequestInfo | URL, init?: RequestInit) {
        record(input, init);
        return Promise.reject(error);
      };
    },
    callCount() {
      return calls;
    },
    lastCall() {
      return { url: lastUrl, signal: lastSignal, method: lastMethod };
    },
  };
}

describe('useKeepBackendWarm', () => {
  const originalFetch = global.fetch;
  let stub: FetchStub;

  beforeEach(function setupStub() {
    stub = createFetchStub();
  });

  afterEach(function restoreFetch() {
    global.fetch = originalFetch;
  });

  it('fires a single GET to /actuator/health on mount', () => {
    stub.installPending();

    renderHook(() => {
      useKeepBackendWarm();
    });

    const call = stub.lastCall();
    expect(stub.callCount()).toBe(1);
    expect(call.url).toMatch(/\/actuator\/health$/);
    expect(call.method).toBe('GET');
    expect(call.signal).toBeInstanceOf(AbortSignal);
  });

  it('swallows network errors silently without re-throwing', async () => {
    stub.installRejecting(new Error('network down'));

    expect(function mountHook() {
      renderHook(() => {
        useKeepBackendWarm();
      });
    }).not.toThrow();

    // Let the rejection settle so an unhandled promise rejection would surface.
    await new Promise(function flush(resolve) {
      setImmediate(resolve);
    });
  });

  it('aborts the in-flight ping when unmounted before response', () => {
    stub.installPending();

    const { unmount } = renderHook(() => {
      useKeepBackendWarm();
    });

    const signal = stub.lastCall().signal;
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal?.aborted).toBe(false);

    unmount();

    expect(signal?.aborted).toBe(true);
  });
});
