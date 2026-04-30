# Phase 1 — Implementation Progress

Updated automatically as tasks complete via `/commit-task` command.

## Status

Task 10 complete. PR open for review.

## Task Checklist

- [x] Task 1: Project Initialization
- [x] Task 2: Design Tokens
- [x] Task 3: Pretendard Font Setup
- [x] Task 4: Supabase Client + Database Types + Query Key Factory
- [x] Task 5: Upload Real Seed Photos (manual)
- [x] Task 6: Shared UI Components
  - [x] Task 6.1: Button
  - [x] Task 6.2: Chip
  - [x] Task 6.3: Card
  - [x] Task 6.4: Skeleton
  - [x] Task 6.5: EmptyState
  - [x] Task 6.6: ErrorBoundary
- [x] Task 7: Data Layer — Services + Hooks
  - [x] Task 7.1: Brands + Categories
  - [x] Task 7.2: Gym Search
  - [x] Task 7.3: Gym Detail + Machines
  - [x] Task 7.4: Photo List
- [x] Task 8: Location Hooks
- [x] Task 9: Expo Router Setup
- [x] Task 10: Gym Bottom Sheet + Cards
- [ ] Task 11: Photo Gallery + Detail
- [ ] Task 12: Empty States + Loading States
- [ ] Task 13: Map Screen (Naver Maps) — ⚠️ blocked on API key
- [ ] Task 14: Animations Polish
- [ ] Task 15: Verification

## Completed Tasks Log

| Task | Commit  | Date       | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---- | ------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | 0df1c25 | 2026-04-20 | Expo SDK 54 scaffolded, tooling configured, GitHub repo created + pushed to main.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2    | cb45104 | 2026-04-24 | Design tokens (colors/typography/spacing/radius/animation) + Tailwind config. PR #1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 3    | d3b7b34 | 2026-04-24 | Pretendard v1.3.9 OTF (Regular/Medium/SemiBold/Bold) + useAppFonts hook.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 4    | 019c721 | 2026-04-24 | Supabase client (MMKV storage), database types, query key factories. PR #3.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 5    | 1c78c9d | 2026-04-25 | 4 real machine photos uploaded to `machine-photos/seed/` (Panatta High Row × 2 angles, Hammer Strength Low Row × 2 angles). Created new `Hammer Strength Low Row` template, repointed 2 gym_machines, updated 5 photo URLs. SQL recorded in `task-5-seed-photos.sql`. PR #4.                                                                                                                                                                                                                                                                                                                                           |
| 6    | 9ee66c4 | 2026-04-25 | 6 shared UI components TDD'd on `src/shared/components/`: Button (variants/sizes/loading/disabled), Chip (animated bg via reanimated interpolateColor), Card (pressable + padding scale), Skeleton (shimmer with cancelAnimation cleanup), EmptyState (icon + a11y grouping), ErrorBoundary (react-error-boundary wrapper with onReset/onError). All memoized leaves, NativeWind v4 className typing wired via `nativewind-env.d.ts`. 35 new tests, 65 total passing.                                                                                                                                                  |
| 7    | d61a53e | 2026-04-27 | Data layer: 4 sub-tasks TDD'd. 7.1 brands/categories services + hooks (staleTime Infinity) + centralised `unwrapList<T>`/`unwrapSingle<T>` helper. 7.2 `searchGymsInBounds` RPC + `useGymSearch` (no `!`, defensive narrow) + `useFilters` local state. 7.3 `getGymMachines` joined select + `useGymMachines` hardened against `undefined` id, structural assertions on `SELECT_WITH_DETAILS`. 7.4 `getMachinePhotos` ordered upvote_count desc + `useMachinePhotos`. Shared test utils: `createQueryWrapper` (gcTime 0), chained supabase mocks, `makeGymMachineWithDetails` factory. 51 new tests, 116 total. PR #8. |
| 8    | aab0ff8 | 2026-04-27 | Location hooks: `useCurrentLocation` (foreground permission → coords / Gangnam Station fallback with Korean error / silent fallback on GPS rejection) and `usePermissionStatus` (passive read on mount, stable `request()` to prompt). Both effects use `AbortController` + an `isAborted()` getter to bypass TS narrowing on `signal.aborted` while staying unmount-safe. Exports `Coordinate` type and `GANGNAM_STATION` constant for downstream Map screen. 9 new tests, 125 total.                                                                                                                                 |
| 9    | 1a41c80 | 2026-04-29 | Expo Router scaffold: root layout wires `ErrorBoundary` + `GestureHandlerRootView` + `QueryClientProvider`, gates render until fonts resolve (loaded or error so the splash never strands users on a font load failure), and registers `(tabs)` / `gym/[id]/machine/[machineId]` / `photo/[id]` (modal). Tab layout exposes 지도/마이 with tints from `tokens.ts` (no literal duplication, FF cohesion 🔴 auto-applied). Map and Me tabs plus the two dynamic routes ship as stubs to be filled in by Tasks 10/11/13. 5 new tests, 130 total. PR #12.                                                                  |

## Blockers

- Naver Cloud Maps API key (needed for Task 13)
