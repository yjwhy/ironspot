---
description: Find hardcoded colors, sizes, or magic numbers that should use design tokens
---

Scan the codebase for values that should use design tokens instead of hardcoded values.

**Detection:**

1. **Hardcoded hex colors** in .tsx/.ts files (other than `tokens.ts` and `tailwind.config.js`)
   - Pattern: `#[0-9A-Fa-f]{3,8}`
   - Exception: `src/shared/theme/tokens.ts`, `tailwind.config.js`

2. **Hardcoded pixel values in style props** (prefer NativeWind classes)
   - Pattern: `padding: \d+`, `margin: \d+`, `fontSize: \d+`, `borderRadius: \d+`
   - Exception: animation code using reanimated transforms

3. **Inconsistent spacing** — values not in {4, 8, 12, 16, 24, 32, 48}

**Report format:**

For each violation:

- File path + line number
- The violation (e.g., `color: '#FF0000'`)
- Suggested replacement (e.g., `use colors.error token`)

If zero violations: "✅ All values use design tokens."

Use Grep tool for efficient scanning. Focus on `src/` and `app/` directories.
