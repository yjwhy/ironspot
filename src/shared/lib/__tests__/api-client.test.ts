/**
 * Regression coverage for the orval-mutator contract. Phase 5 item 12 surfaced
 * that `apiClient` had been returning the bare response body cast as the orval
 * wrapper type — `response.data` was undefined at runtime for every consumer,
 * which only mattered once an upload actually succeeded.
 *
 * These tests mock ky at the module boundary so we can assert apiClient's
 * runtime return shape (`{ data, status, headers }`) without standing up a
 * real fetch path.
 */

import { apiClient } from '../api-client';

jest.mock('ky', () => {
  const kyMock = jest.fn();
  const create = jest.fn(() => kyMock);
  const HTTPError = class extends Error {
    response: { status: number };
    constructor(status: number) {
      super('HTTP error');
      this.response = { status };
    }
  };
  const TimeoutError = class extends Error {};
  return {
    __esModule: true,
    default: { create },
    HTTPError,
    TimeoutError,
    __kyMock: kyMock,
  };
});

jest.mock('../supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      refreshSession: jest.fn(),
    },
  },
}));

jest.mock('../api-base-url', () => ({ API_URL: 'https://test.invalid' }));

interface WrappedResponse<T> {
  data: T;
  status: number;
  headers: Headers;
}

interface PayloadShape {
  photoId: string;
  ocrSucceeded: boolean;
}

function buildFakeResponse(status: number, body: unknown, contentLength?: string): Response {
  const headers = new Headers();
  if (contentLength !== undefined) {
    headers.set('content-length', contentLength);
  }
  return {
    status,
    headers,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function getKyMock(): jest.Mock {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('ky') as { __kyMock: jest.Mock };
  return mod.__kyMock;
}

describe('apiClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('wraps a 201 JSON body in { data, status, headers }', async () => {
    const body: PayloadShape = { photoId: 'p-1', ocrSucceeded: true };
    getKyMock().mockResolvedValue(buildFakeResponse(201, body));

    const result = await apiClient<WrappedResponse<PayloadShape>>('api/photos/upload');

    expect(result.status).toBe(201);
    expect(result.data).toEqual(body);
    expect(result.headers).toBeInstanceOf(Headers);
  });

  it('wraps a 200 JSON body without losing the parsed payload', async () => {
    const body = { id: 'g-1', name: 'Test Gym' };
    getKyMock().mockResolvedValue(buildFakeResponse(200, body));

    const result = await apiClient<WrappedResponse<typeof body>>('api/gyms/g-1');

    expect(result.data).toEqual(body);
    expect(result.status).toBe(200);
  });

  it('skips JSON parsing on 204 and returns data: undefined', async () => {
    const jsonSpy = jest.fn().mockResolvedValue(null);
    const fakeResponse = {
      status: 204,
      headers: new Headers(),
      json: jsonSpy,
    } as unknown as Response;
    getKyMock().mockResolvedValue(fakeResponse);

    const result = await apiClient<WrappedResponse<void>>('api/photos/p-1');

    expect(result.status).toBe(204);
    expect(result.data).toBeUndefined();
    expect(jsonSpy).not.toHaveBeenCalled();
  });

  it('skips JSON parsing when content-length is 0', async () => {
    const jsonSpy = jest.fn().mockResolvedValue(null);
    const headers = new Headers();
    headers.set('content-length', '0');
    const fakeResponse = {
      status: 200,
      headers,
      json: jsonSpy,
    } as unknown as Response;
    getKyMock().mockResolvedValue(fakeResponse);

    const result = await apiClient<WrappedResponse<void>>('api/empty');

    expect(result.data).toBeUndefined();
    expect(jsonSpy).not.toHaveBeenCalled();
  });
});
