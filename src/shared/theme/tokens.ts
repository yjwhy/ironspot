// Kept in sync with tailwind.config.js. Values here are for JS-side consumers
// (StyleSheet, reanimated, inline styles). Tailwind utility classes read from
// tailwind.config.js. `spacing` and `ANIMATION` are JS-only.

export const colors = {
  accent: { DEFAULT: '#F59E0B', light: '#FCD34D', dark: '#D97706', 50: '#FFFBEB' },
  text: { primary: '#0F172A', secondary: '#475569', tertiary: '#94A3B8', inverse: '#FFFFFF' },
  bg: { base: '#FFFFFF', subtle: '#F8FAFC', muted: '#F1F5F9' },
  border: { DEFAULT: '#E2E8F0', focus: '#F59E0B' },
  success: '#22C55E',
  error: '#EF4444',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const ANIMATION = {
  stagger: 60,
  microDuration: 250,
  transitionDuration: 400,
} as const;
