// Per-endpoint TanStack Query staleTime constants. Lives in its own module so feature
// hooks can import the values without pulling in `query-client.ts` (which depends on ky
// via api-client.ts; ky is ESM-only and Jest's default transform chokes on it unless
// the importing test mocks api-client).
//
// Task 32 plan staleTime policy:
//   brands / categories: Infinity (static reference data)
//   gym search / gym detail / gym machines: STALE_TIME_DEFAULT_MS (5 min)
//   photos: STALE_TIME_PHOTOS_MS (1 min) — user-generated content; new uploads should
//     surface quickly without a full app reload.

export const STALE_TIME_DEFAULT_MS = 1000 * 60 * 5;

export const STALE_TIME_PHOTOS_MS = 1000 * 60;
