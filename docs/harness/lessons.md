# Session Lessons

Surprises that bit during implementation and were not caught by lint, types, or tests until after time was lost. **Only add entries that future sessions can repeat without this file.** If ESLint, TypeScript, or a test-setup helper can encode the rule, mechanise it instead — do not put it here.

## Pruning rules

- Each entry is dated and tied to the task that surfaced it.
- Re-evaluate quarterly. Delete entries that are no longer relevant (dependency upgraded, infra change made it impossible, etc.).
- Keep total length under ~200 lines. If it grows past that, the bar for new entries was too low.

## Format

```
### YYYY-MM-DD / Task N — One-line title

Short context (1-2 sentences) describing when this bites.
Workaround / pattern (code snippet if useful).
```

---

### 2026-04-25 / Task 6 — NativeWind v4: `Pressable.className` is string-only

`Pressable` accepts `style={({ pressed }) => ...}` but not `className={({ pressed }) => ...}`. NativeWind v4's className prop typing is `string`. For pressed-state styling, keep `className` static and put dynamic values in `style`.

```tsx
// Wrong — className callback is not supported
<Pressable className={({ pressed }) => `... ${pressed ? 'opacity-80' : ''}`} />

// Correct — split: className static, style callback dynamic
<Pressable
  className="rounded-lg bg-bg-elevated"
  style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
/>
```

---

### 2026-04-25 / Task 6 — Hidden a11y nodes are excluded from default queries

`@testing-library/react-native` skips elements with `accessibilityElementsHidden={true}` or `importantForAccessibility="no"` even for `getByTestId`. Pass `{ includeHiddenElements: true }` to find them. Better: do not manufacture derived testIDs (e.g. `${testID}-icon`) for decorative hidden nodes — query the component type instead.

```tsx
// Avoid creating a `${testID}-icon` contract between component and tests.
// For decorative MaterialIcons that are hidden from screen readers:
const { UNSAFE_queryAllByType } = render(<EmptyState icon="search-off" title="비어 있어요" />);
expect(UNSAFE_queryAllByType(MaterialIcons)).toHaveLength(1);
```

---

### 2026-04-25 / Task 6 — Assert a11y state via query options, not `.props` access

Reading `node.props.accessibilityState` directly trips `@typescript-eslint/no-unsafe-member-access` because the testing-library `ReactTestInstance.props` is typed loosely. Use the typed query overload, or `toHaveProp`.

```ts
// Wrong — lint error on .props.accessibilityState
expect(button.props.accessibilityState).toEqual({ disabled: true, busy: true });

// Correct — typed query option
expect(getByRole('button', { disabled: true, busy: true })).toBeTruthy();

// Or, for non-role attributes
expect(getByTestId('skel')).toHaveProp('accessibilityRole', 'progressbar');
```

---

### 2026-04-25 / Task 6 — React 19 + react-error-boundary retry tests need an onReset-driven harness

A throwing child that uses local state ("throw once then succeed") does not survive `resetErrorBoundary` because children remount on reset and local state resets, so the throw repeats. Drive recovery from a parent harness that toggles its own state in the boundary's `onReset`. This requires `onReset` to be a prop on the wrapper.

```tsx
function RetryHarness() {
  const [retried, setRetried] = useState(false);
  return (
    <ErrorBoundary
      onReset={() => {
        setRetried(true);
      }}
    >
      {retried ? <Text>after retry</Text> : <Throws message="boom" />}
    </ErrorBoundary>
  );
}
```

---

### 2026-05-02 / Task 11.5 — `PressableStateCallbackType` augmentation drifts between local and CI

CI typecheck failed on `pressedOpacity` test arguments because Expo augments
`PressableStateCallbackType` in `node_modules/expo/types/react-native-web.d.ts`
(adds `hovered: boolean`) only when its augmentation file is loaded. That
load order differs between local pnpm install and CI's `--frozen-lockfile`
fresh install, so locally `hovered` was required, on CI it didn't exist.
**Do not type test helpers that take Pressable state with the imported
`PressableStateCallbackType`** — use a structural narrower type and rely on
function-arg contravariance so callers (Pressable's actual `style` prop)
still typecheck.

```ts
// Wrong — environment-dependent type drift
export function pressedOpacity({ pressed }: PressableStateCallbackType) { ... }

// Correct — structural shape, no augmentation dependency
export function pressedOpacity({ pressed }: { pressed: boolean }) { ... }
```

Tests then pass `{ pressed: true }` directly with no extra fields.

---

### 2026-05-02 / Task 11.4 — reanimated v4 dropped the SharedTransition API

`ui-design.md` calls for a hero / shared-element morph between the photo grid
and the photo detail modal (`Photo grid → Photo detail: Hero/shared element`).
Reanimated v3 implemented this via `sharedTransitionTag` on `Animated.*`
components. The installed reanimated (4.1.7) no longer ships the API or its
type definitions, so the prop is rejected at compile time. **Do not
re-attempt with reanimated alone.**

When revisiting (Phase 2 polish), the supported path is
`react-native-screens` v4+ native shared elements (`screensEnableExperimentalNativeStackV5`

- matching `tag` props) once expo-router exposes the necessary plumbing.
  Phase 1 falls back to the modal slide-up (`presentation: 'modal'` in
  `app/_layout.tsx`). Breadcrumb left in `PhotoGrid.tsx` BestCutCard.

---

### 2026-04-25 / Task 6 — `@expo/vector-icons` testID does not propagate to a host node

A `<MaterialIcons testID="x" />` does not produce a node queryable by `getByTestId('x')`; the testID lives on a non-host React class instance. Either wrap in `<View testID="x">` (which leaks an internal contract to tests) or query by component type via `UNSAFE_queryAllByType(MaterialIcons)`. Prefer the latter for decorative icons.
