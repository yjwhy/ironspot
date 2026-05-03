# .maestro/ — End-to-End Tests

Maestro flows for IronSpot. Task → flow mapping lives in `docs/harness/e2e-strategy.md`.

## Preconditions for any `pnpm e2e:*`

1. **iOS simulator booted with the IronSpot dev build installed**
   - First time / native deps changed: `pnpm expo run:ios`
   - Subsequent: `pnpm expo start --dev-client`
2. **Metro bundler running** in the background
3. **Maestro CLI on PATH**: `curl -Ls "https://get.maestro.mobile.dev" | bash` (installs to `~/.maestro/bin`)

## Commands

```bash
pnpm e2e:smoke                  # smoke flow only (~30s)
pnpm e2e:flow .maestro/flows/X  # single flow
pnpm e2e:all                    # full suite (Phase 1 verification)
```

## Selector Lessons

### Bottom-tab labels are wrapped with role text

React Navigation tab labels (e.g. `tabBarLabel: '지도'`) surface as accessibilityText `"지도, tab, 1 of 2"`. Maestro's substring matcher does **not** pick up "지도" reliably.

**Workaround**: assert against the screen body text instead (e.g. `"지도 화면"`), or use `id: <testID>` selector.

### `<Pressable accessibilityLabel="...">` swallows child Text

React Native's `<Pressable accessible accessibilityLabel="...">` swallows child `<Text>` nodes into the parent label, so the visible inner Text is invisible to Maestro.

**Workaround**: query by `id: <testID>` rather than visible text. Example: PhotoGrid's Best Cut card uses `testID="photo-grid-best-cut"`.

### Deep links bypass missing screens

Until Task 13 (Map) ships, photo flows enter via `openLink: ironspot:///gym/x/machine/...` instead of map → bottom sheet → machine row. **Switch back to the tap-driven path when Task 13 lands.**

## Failure handling

- Same flow flakes once → retry. Two failures in a row → real problem; investigate.
- One success / one failure → flaky; record in `docs/harness/failure-patterns.md` and report to user.
