import type { PressableStateCallbackType } from 'react-native';

/**
 * Standard pressed-state opacity for Pressable wrappers across the app.
 * Pass to `<Pressable style={pressedOpacity} />`. Keeps the 0.8 baseline
 * shared by Card and the rest of the design tokens consistent everywhere.
 */
export function pressedOpacity({ pressed }: PressableStateCallbackType): { opacity: number } {
  return { opacity: pressed ? 0.8 : 1 };
}
