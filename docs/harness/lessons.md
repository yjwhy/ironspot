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

---

### 2026-05-02 / Task 12.4 — RNTL does not register `accessibilityRole="alert"` in its role map

`render(<View accessibilityRole="alert" />)` renders correctly but `getByRole('alert')` throws "Unable to find an element with role: alert". `@testing-library/react-native`'s native role map omits `alert` (and several other ARIA roles RN supports). Assert the prop directly via `toHaveProp` on a `testID` instead — the role still reaches iOS VoiceOver / Android TalkBack at runtime.

```tsx
expect(getByTestId('offline-banner')).toHaveProp('accessibilityRole', 'alert');
```

---

### 2026-05-02 / Task 12.4 — `NetInfo.isConnected` does not detect captive portals

`@react-native-community/netinfo` exposes both `isConnected` (interface up) and `isInternetReachable` (HTTP probe succeeds). `isConnected` alone misses the "Wi-Fi joined but the captive-portal login page is not yet completed" case. Phase 1's offline banner only listens to `isConnected`, which is correct for the stated UX (cellular dead-zone awareness). If a future feature needs to distinguish "no internet" from "no interface", switch to `isInternetReachable !== false`.

---

### 2026-05-05 / Task 13 — NaverMapView causes Jest OOM / SIGABRT via native module chain

Rendering `MapScreen` (or any component that imports `NaverMapView`) in Jest crashes the process with SIGABRT or runs out of memory. The cause is the native module chain: `NaverMapView` → reanimated worklets → native bridge, which Jest cannot sandbox. `moduleNameMapper` redirecting `@mj-studio/react-native-naver-map` to a lightweight mock is not enough — the crash happens during Jest's module evaluation, before the mock is applied.

**Fix:** Extract all pure logic out of `MapScreen` into sibling files (`mapUtils.ts`, etc.) and unit-test those. Add the component files to `collectCoverageFrom` exclusions in `jest.config.js`. Rely on Maestro E2E for render coverage of `MapScreen` and `GymMarker`.

```js
// jest.config.js — exclude native-overlay components from coverage
'!src/features/map/components/MapScreen.tsx',
'!src/features/map/components/GymMarker.tsx',
```

---

### 2026-05-05 / Task 13 — `@shopify/flash-list` v2 removed `estimatedItemSize` and deprecated `BottomSheetFlashList`

Flash-list v2.0.x is a full rewrite (`RecyclerView` under the hood). `estimatedItemSize` no longer exists in `FlashListProps` — TypeScript will error. `@gorhom/bottom-sheet` v5.2+ deprecated `BottomSheetFlashList`; the replacement is `useBottomSheetScrollableCreator()` returning a `renderScrollComponent` callback to pass to `<FlashList>` directly. Test mock: add a `jest.mock('@shopify/flash-list', ...)` that returns `BottomSheetListMock` for `FlashList`; add `useBottomSheetScrollableCreator: jest.fn(() => jest.fn())` to the bottom-sheet mock.

---

### 2026-05-02 / Task 12.4 — Reanimated banners are hidden by iOS `presentation: 'modal'`

Mounting a global `<OfflineBanner />` as a sibling of `<Stack>` in `app/_layout.tsx` floats it over normal stack screens but **not** over modal screens. iOS modals (`presentation: 'modal'`) render in a separate native window above the root view hierarchy, so an absolute-positioned banner in the root tree is occluded. Phase 1 accepts this — the user closes the modal to see the banner. If a future requirement needs banners on modals, mount a second instance inside the modal screen, or migrate to a portal-based approach.

---

### 2026-11-24 / Expo SDK 58 — react-navigation v7 `useBottomTabBarHeight()` throws instead of returning near-zero

`@react-navigation/bottom-tabs` v7's `useBottomTabBarHeight()` throws `"Couldn't find the bottom tab bar height. Are you inside a screen in Bottom Tab Navigator?"` when the `BottomTabBarHeightContext` is absent. v6 returned a near-zero value instead. Any component rendered through a portal that strips the tab context (e.g. `@gorhom/bottom-sheet`) will crash into the ErrorBoundary at runtime. This is a **runtime-only regression** that jest, tsc, and lint all miss — the GymBottomSheet unit test mocked the hook to return 83, so the suite stayed green while the real Map screen crashed to a black screen on device.

**Fix:** read the context directly, `useContext(BottomTabBarHeightContext) ?? 0`, which reproduces the v6-tolerant behavior. In tests, mock the module to export `BottomTabBarHeightContext: React.createContext(<height>)` rather than the removed hook. Caught by on-device render + `pnpm e2e:smoke`, not by the JS trio.

---

### 2026-11-24 / Expo SDK 58 — react-native-nitro-modules must satisfy BOTH mmkv's ABI and RN 0.88's iOS JSI hook (use 0.37.2, not mmkv's devDep)

`react-native-mmkv` 4.3.2 (used via nitro) pulls two conflicting-looking constraints on `react-native-nitro-modules`, and the naive pick (mmkv's own devDependency, 0.35.9) passes Android but crashes iOS at runtime. Both must be satisfied by one version:

1. **Android ABI (`CxxPart`):** mmkv 4.3.2's nitrogen-generated C++ references `margelo::nitro::JHybridObject::CxxPart`, which 0.32.2 lacks → `:react-native-mmkv:buildCMakeDebug` fails with `no member named 'CxxPart'`. `CxxPart` exists in 0.35.x and is retained in 0.37.x.
2. **iOS JSI hook (RN 0.88):** React Native 0.88 calls the two-argument iOS selector `installJSIBindingsWithRuntime:callInvoker:`. nitro < 0.36.2 implements only the one-arg `installJSIBindingsWithRuntime:`, so nitro's installer never runs and the app red-boxes at runtime with `Failed to install Nitro: installJSIBindingsWithRuntime: was not called` (chain: `useRecentSearches → createMMKV → NitroModules.install()`). This is iOS-only and runtime-only — the JS trio, the Android build, and the Android runtime all stay green, so only an on-device iOS launch catches it.

**Resolution: pin `react-native-nitro-modules` to 0.37.2** (has `CxxPart` for Android AND the two-arg hook for iOS). Do NOT just match `node_modules/react-native-mmkv/package.json` devDependencies — that is 0.35.9 and is too old for RN 0.88 iOS. Dead ends that look plausible but are NOT the fix: `expo-build-properties` `ios.usePrecompiledModules: false` and `ios.buildReactNativeFromSource: true` (the error is the nitro version, not precompilation). After bumping: `pnpm install`, `expo prebuild --clean`, clear stale CMake caches (`rm -rf node_modules/react-native-mmkv/android/.cxx node_modules/react-native-{mmkv,nitro-modules}/android/build`), rebuild both platforms.

**`.DS_Store` breaks Android prefab:** an Android CMake build can fail at `:<module>:configureCMakeDebug` with `com.google.prefab.api.MissingPlatformIDException: … /prefab/modules/reactnative/libs/.DS_Store does not contain a platform ID`. A macOS `.DS_Store` landed in the react-android Gradle transform cache and prefab tried to read it as a platform artifact. Fix: `find ~/.gradle/caches -name .DS_Store -delete` and rebuild. Not a dependency problem — it masquerades as one.

---

### 2026-11-24 / Expo SDK 58 — CNG native build gotchas: Naver maven repo + Xcode 26.4, and an adb-reverse dev-server trap

Three native-build facts surfaced verifying the SDK 58 bump under the CNG workflow (android/ios are gitignored, regenerated by `expo prebuild --clean`):

1. **Naver Maps Android SDK repo must be declared in app.json.** `com.naver.maps:map-sdk` is hosted at `https://repository.map.naver.com/archive/maven`, not Maven Central. The `@mj-studio/react-native-naver-map` plugin does **not** register it, so a clean prebuild fails to resolve it. Add it via expo-build-properties `android.extraMavenRepos` — it writes into `android/gradle.properties` at prebuild and the RN gradle plugin injects it. A manual `android/build.gradle` edit is lost on the next prebuild.
2. **iOS build requires Xcode 26.4+ (Swift 6.2 tools).** SDK 58 modules (expo-modules-core/apple, etc.) use `swift-tools-version 6.2`. With Xcode 16.x you get `xcodebuild` error 65 `package 'apple' is using Swift tools version 6.2.0 but installed is 6.1.0`. Not fixable by flags — it is a hard toolchain floor.
3. **Debug build connecting to Metro on an emulator:** `expo run:android` bakes the host LAN IP into the launch deep link, which the emulator often cannot reach, leaving a black screen with `ReconnectingWebSocket: Couldn't connect to ws://10.0.2.2:8081`. `adb reverse tcp:8081 tcp:8081` (expo usually sets this) plus relaunching the app so it reads `localhost:8081` fixes it. Verify JS actually executed by checking the Metro process log for `Android Bundled … (N modules)` and any `ERROR [ErrorBoundary]` lines — a black screen alone does not tell you whether it was a connectivity issue or a JS crash.
