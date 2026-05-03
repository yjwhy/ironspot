# src/ — Application Code

Feature-based organization. Related code stays together.

## Structure

```
src/
├── features/
│   ├── map/        (MapView, markers, filters, search)
│   ├── gym/        (GymCard, GymDetail, MachineList, BottomSheet)
│   ├── photo/      (Gallery, PhotoCard, UploadFlow)
│   ├── auth/       (Phase 2: login)
│   └── search/     (Phase 3: NL search)
└── shared/
    ├── components/ (Button, Chip, Card — custom built)
    ├── hooks/      (useLocation, useNetworkStatus, ...)
    ├── lib/        (supabase client, query keys, formatters)
    ├── theme/      (tokens, fonts)
    └── types/      (database types, shared interfaces)
```

Path alias: `@/*` → `src/*`.

## Code Quality

- Functions <50 lines; files <800 lines (typical 200–400)
- No `any` — use `unknown` and narrow
- No `!` non-null assertions — narrow with type guards
- Type-only imports: `import type { ... }` (ESLint enforced)
- No `console.log` in production code
- No hardcoded secrets, no magic numbers, no deep nesting (>4 levels)
- Prefer function declarations over const arrow functions
- Name complex booleans descriptively
- Composition over prop drilling
- Separate significantly different conditional UI into distinct components

## TypeScript

- `interface` for extensible object shapes; `type` for unions / intersections / mapped / conditional
- **Branded types for IDs** to prevent ID mixing:
  ```ts
  type Brand<K, T> = K & { __brand: T };
  export type GymId = Brand<string, 'GymId'>;
  ```
- **Discriminated unions** for state/status:
  ```ts
  type LoadState =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'success'; data: T }
    | { status: 'error'; error: Error };
  ```
- `readonly` and `as const` where possible
- Prefer `null` over `undefined` for intentional absence (DB nullable columns); reserve `undefined` for "not yet set"

For deeper TS patterns, use the `typescript-patterns` skill.

## Immutability

Always create new objects, never mutate.

```ts
// ✅ return { ...user, name }
// ❌ user.name = name
```

## Performance (CRITICAL — slow = broken)

- React Compiler is enabled (ADR 0018) — do **NOT** hand-roll `useMemo` / `useCallback` / `React.memo`
- The only remaining case for `React.memo` is a custom prop comparator (RC's auto-memo is shallow-equal only)
- Reanimated worklets stay annotated with `'worklet'`; may need `'use no memo'` if RC interferes
- Tests do not see RC — do not assert "stable reference across re-renders"
- FlashList over FlatList for lists >50 items; always set `estimatedItemSize`; `getItemType` for heterogeneous lists
- Animate only `transform` / `opacity` (GPU); cancel reanimated animations on unmount; spring physics over linear timing
- Stagger 50–80ms between items
- Images: resize/compress, `cachePolicy: 'memory-disk'` for frequently shown, progressive loading

For details: `vercel-react-best-practices` and `vercel-react-native-skills` skills.

## Data

- TanStack Query for **all** server state; client state minimal (MMKV for persistence)
- `staleTime` tuned per query (static data = `Infinity`)
- Validate at boundaries with Zod
- Pagination over loading all data; prefetch on focus before navigation

## Supabase

- PostGIS geography type for location data
- RPC functions for complex queries
- Denormalize counts (`upvote_count`) for query performance
- RLS policies for data access control
- Validate with Zod at data boundaries

For details: `supabase-postgres-best-practices` skill.
