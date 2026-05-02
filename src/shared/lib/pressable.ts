/**
 * Standard pressed-state opacity for Pressable wrappers across the app.
 * Pass to `<Pressable style={pressedOpacity} />`. Keeps the 0.8 baseline
 * shared by Card and the rest of the design tokens consistent everywhere.
 *
 * Param is typed structurally (`{ pressed: boolean }`) instead of RN's
 * `PressableStateCallbackType` because Expo augments that type with `hovered`
 * for web only when its augmentation file is loaded — which is environment
 * dependent (local vs CI). The structural shape is forwards-compatible with
 * Pressable's signature via function-arg contravariance.
 */
export function pressedOpacity({ pressed }: { pressed: boolean }): { opacity: number } {
  return { opacity: pressed ? 0.8 : 1 };
}
