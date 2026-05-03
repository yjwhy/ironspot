# app/ — Expo Router Routes

File-based routing. Each file under `app/` is a route. Type-safe via `typedRoutes`.

## Structure

```
app/
├── _layout.tsx                       (root: providers, OfflineBanner, ErrorBoundary)
├── (tabs)/
│   ├── _layout.tsx                   (tab layout)
│   ├── index.tsx                     (Map tab)
│   └── me.tsx                        (My Page tab)
├── gym/[id]/machine/[machineId].tsx  (photo gallery)
└── photo/[id].tsx                    (photo detail, modal presentation)
```

## Conventions

- **Routes are thin delegates** — keep screen components in `src/features/<feature>/components/`. The route file imports and renders the screen component, nothing more.
- **Modals**: set `presentation: 'modal'` in the parent `<Stack.Screen options={...}>`.
- **Type-safe params**: `useLocalSearchParams<{ id: string }>()` and narrow before use.
- **Tab labels**: source from `src/shared/theme/tokens.ts`, not literals (FF cohesion principle).
- **Root-level overlays** (`OfflineBanner`, `ErrorBoundary`): mount in `_layout.tsx` as siblings of `<Stack>`. iOS modal screens render in a separate native window and **occlude** root-level overlays — accepted Phase 1 limitation; banner/error reappears on modal close.

## Navigation

- Lazy-load heavy screens; `react-native-screens` (default in Expo) handles native stack performance
- Avoid deep navigation stacks (>3 levels)
- Deep links: `ironspot:///<path>` — see `app.json` `scheme`. Phase 1 photo flows enter via deep link until Task 13 (Map) ships the tap-driven path.
