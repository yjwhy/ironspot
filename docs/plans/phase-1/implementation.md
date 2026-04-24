# Phase 1 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Phase:** 1 (Read-Only MVP)
**Version:** 3.0
**Date:** 2026-04-18
**Author:** YJ (builtByYJ)

## Goal

Build a read-only mobile app that displays gyms on a map with filter/search, machine lists, and photo galleries — powered by seed data already loaded in Supabase.

## Architecture Summary

- Expo (SDK 52+) app connecting directly to Supabase (no API server in Phase 1)
- **Expo Router** for file-based routing with type-safe navigation + built-in deep linking
- PostGIS for spatial queries
- TanStack Query with Query Key Factory pattern for cache management
- NativeWind v4 for styling
- Pretendard font for Korean + English
- `@mj-studio/react-native-naver-map` for map rendering

## Confirmed Decisions (from 2026-04-18)

| #               | Choice                                                    |
| --------------- | --------------------------------------------------------- |
| Navigation      | Expo Router                                               |
| Seed photos     | Real photos uploaded to Supabase Storage                  |
| Path alias      | `@/*` → `src/*`                                           |
| NativeWind      | v4                                                        |
| ESLint          | `@typescript-eslint/strict` + `eslint-plugin-react-hooks` |
| Map SDK         | `@mj-studio/react-native-naver-map`                       |
| Query Key       | Hand-rolled Query Key Factory (per feature)               |
| Error Boundary  | `react-error-boundary` in Phase 1                         |
| Package Manager | pnpm (always)                                             |

## Pre-requisites (already complete)

- Supabase project created (iron-spot)
- Schema + seed data loaded
- Storage bucket (machine-photos) created + public
- PostGIS enabled
- Migration 002 applied (quantity, operating_hours, reports.status, etc.)
- Upvote/remove_upvote RPCs created

## Still pending before coding starts

- [ ] Naver Cloud Maps API key from Korean friend (blocks Task 13)
- [ ] Real machine photos uploaded to Supabase Storage (Task 5)
- [ ] `.env` file created with all keys

---

## Task 1: Project Initialization

**Files:**

- Create: `package.json`, `tsconfig.json`, `app.json`, `babel.config.js`, `metro.config.js`
- Create: `.env.example`, `.gitignore`, `.eslintrc.js`, `.prettierrc`
- Create: `src/` folder structure, `app/` folder (Expo Router)
- Create: `env.d.ts` for type-safe env vars

### Step 1: Create Expo project

```bash
cd ~/Desktop/personal/development/project/iron-spot
pnpm create expo-app@latest . --template default
```

The `default` template includes Expo Router setup.

### Step 2: Install all dependencies

```bash
# Expo Router is already in default template; ensure latest
pnpm expo install expo-router expo-linking expo-constants

# Styling (NativeWind v4)
pnpm add nativewind
pnpm add -D tailwindcss@^3.4.17

# State management
pnpm add @tanstack/react-query

# Animation & Gesture
pnpm expo install react-native-reanimated react-native-gesture-handler

# Bottom Sheet
pnpm add @gorhom/bottom-sheet

# Supabase
pnpm add @supabase/supabase-js

# HTTP + Forms
pnpm add ky react-hook-form zod @hookform/resolvers

# Local storage
pnpm add react-native-mmkv

# Date
pnpm add dayjs

# Toast
pnpm add burnt

# SVG
pnpm expo install react-native-svg

# Error Boundary
pnpm add react-error-boundary

# Map (confirmed: @mj-studio)
pnpm add @mj-studio/react-native-naver-map

# Expo modules
pnpm expo install expo-location expo-font expo-splash-screen @expo/vector-icons expo-status-bar

# Testing
pnpm add -D jest jest-expo @testing-library/react-native @testing-library/jest-native @types/jest
pnpm add -D ts-jest

# Linting / formatting
pnpm add -D eslint prettier eslint-config-prettier eslint-plugin-react-hooks
pnpm add -D @typescript-eslint/eslint-plugin @typescript-eslint/parser
pnpm add -D eslint-config-expo
pnpm add -D eslint-plugin-import eslint-import-resolver-typescript
pnpm add -D eslint-plugin-react-native

# Pre-commit hooks
pnpm add -D husky lint-staged
```

### Step 3: Create folder structure

```bash
# Expo Router entry
mkdir -p app/\(tabs\)
mkdir -p app/gym/\[id\]/machine
mkdir -p app/photo

# Feature-based source
mkdir -p src/features/map/{components,hooks,services,__tests__}
mkdir -p src/features/gym/{components,hooks,services,__tests__}
mkdir -p src/features/photo/{components,hooks,services,__tests__}
mkdir -p src/shared/{components,hooks,lib,theme,types}
mkdir -p src/shared/components/__tests__

# Fonts assets
mkdir -p assets/fonts
```

### Step 4: `tsconfig.json` with path alias + strict

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

### Step 5: `babel.config.js`

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
    plugins: [
      'react-native-reanimated/plugin', // MUST be last
    ],
  };
};
```

### Step 6: `metro.config.js` (required by NativeWind v4)

```js
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: './global.css' });
```

### Step 7: `app.json`

```json
{
  "expo": {
    "name": "IronSpot",
    "slug": "iron-spot",
    "scheme": "ironspot",
    "version": "0.1.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#FFFBEB"
    },
    "plugins": [
      "expo-router",
      "expo-font",
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "주변 헬스장을 찾기 위해 위치 정보가 필요합니다"
        }
      ]
    ],
    "experiments": {
      "typedRoutes": true
    },
    "ios": {
      "bundleIdentifier": "com.ironspot.app",
      "supportsTablet": false
    },
    "android": {
      "package": "com.ironspot.app"
    }
  }
}
```

### Step 8: `.eslintrc.js`

```js
module.exports = {
  extends: [
    'expo',
    'plugin:@typescript-eslint/strict-type-checked',
    'plugin:@typescript-eslint/stylistic-type-checked',
    'plugin:react-hooks/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier',
  ],
  plugins: ['@typescript-eslint', 'react-hooks', 'import', 'react-native'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  settings: {
    'import/resolver': {
      typescript: { project: './tsconfig.json' },
      node: true,
    },
  },
  rules: {
    // React hooks
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'error',

    // TypeScript strictness
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    '@typescript-eslint/prefer-nullish-coalescing': 'error',
    '@typescript-eslint/prefer-optional-chain': 'error',

    // Console
    'no-console': ['error', { allow: ['warn', 'error'] }],

    // Imports
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', ['parent', 'sibling'], 'index'],
        pathGroups: [{ pattern: '@/**', group: 'internal' }],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],
    'import/no-duplicates': 'error',
    'import/no-cycle': 'error',
    'import/no-default-export': 'off', // Expo Router requires default exports

    // React Native — only the rules that make sense with NativeWind
    'react-native/no-raw-text': 'error',
    'react-native/no-inline-styles': 'off', // allowed for dynamic values
    'react-native/no-unused-styles': 'off', // using NativeWind, no StyleSheet
    'react-native/no-color-literals': 'off', // design tokens in tailwind config
    'react-native/split-platform-components': 'off',
  },
  ignorePatterns: [
    'node_modules/',
    '.expo/',
    'dist/',
    '*.config.js',
    'babel.config.js',
    'metro.config.js',
    'jest.config.js',
  ],
};
```

### Step 9: `.prettierrc`

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

### Step 9a: `.editorconfig`

```ini
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false
```

### Step 9b: `.vscode/settings.json` (Cursor also uses this)

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.organizeImports": "never"
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "eslint.validate": ["javascript", "typescript", "typescriptreact", "javascriptreact"],
  "files.associations": {
    "*.css": "tailwindcss"
  }
}
```

### Step 10: `.gitignore`

```gitignore
node_modules/
.expo/
dist/
web-build/
*.log
.env
.env.local
.DS_Store
ios/
android/
```

### Step 11: `.env.example` + `env.d.ts`

```bash
# .env.example
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
EXPO_PUBLIC_NAVER_MAP_CLIENT_ID=your_naver_client_id_here
```

```ts
// env.d.ts (at project root)
declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_SUPABASE_URL: string;
    EXPO_PUBLIC_SUPABASE_ANON_KEY: string;
    EXPO_PUBLIC_NAVER_MAP_CLIENT_ID: string;
  }
}
```

### Step 11a: Env runtime validation

Env vars are validated at app startup — missing/invalid values fail loud instead of causing silent runtime bugs.

```ts
// src/shared/lib/env.ts
import { z } from 'zod';

const envSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.string().url(),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(10),
  EXPO_PUBLIC_NAVER_MAP_CLIENT_ID: z.string().min(1),
});

const parsed = envSchema.safeParse({
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  EXPO_PUBLIC_NAVER_MAP_CLIENT_ID: process.env.EXPO_PUBLIC_NAVER_MAP_CLIENT_ID,
});

if (!parsed.success) {
  throw new Error(
    `Invalid environment variables:\n${JSON.stringify(parsed.error.flatten().fieldErrors, null, 2)}`,
  );
}

export const env = parsed.data;
```

Use `env.EXPO_PUBLIC_SUPABASE_URL` everywhere instead of `process.env.EXPO_PUBLIC_SUPABASE_URL`.

Update `src/shared/lib/supabase.ts` (created later in Task 4) to import from `./env`.

### Step 12: Jest setup

```js
// jest.config.js
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEach: ['@testing-library/jest-native/extend-expect'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg))',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/__tests__/**',
    '!src/**/types.ts',
    '!src/**/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
```

### Step 12a: Husky + lint-staged

Pre-commit hook runs prettier + eslint on staged files. Catches issues even if agent's hooks skip.

```bash
pnpm exec husky init
```

Create `.husky/pre-commit`:

```bash
pnpm exec lint-staged
```

Add to `package.json`:

```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md,yml,yaml}": ["prettier --write"]
  }
}
```

### Step 13: Package scripts

Add to `package.json`:

```json
{
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint . --ext .ts,.tsx",
    "format": "prettier --write \"**/*.{ts,tsx,json,md}\"",
    "prepare": "husky"
  }
}
```

### Step 14: Verify

```bash
pnpm install
pnpm lint
pnpm test
```

Both should run without errors (test suite is empty, just verifying Jest starts).

### Step 15: Git init + initial commit

```bash
git init
git branch -m main
git add .
git commit -m "chore: initialize expo project with full tooling"
```

### Step 16: Create GitHub repository + push

**Pre-requisites:** `gh` CLI installed and authenticated (`gh auth login`).

```bash
# Create public repo under yjwhy account
gh repo create yjwhy/ironspot --public --source=. --remote=origin --description "Find specific gym equipment at nearby gyms — React Native + Spring Boot"

# Push main branch with upstream tracking
git push -u origin main
```

Verify: `https://github.com/yjwhy/ironspot` should show the initial commit.

### Step 17: Branch strategy

From Task 2 onwards, each task goes on its own feature branch:

```bash
# Start a new task
git checkout -b task/<N>-<short-name>   # e.g., task/2-design-tokens

# Work on task...
# Commit with /commit-task N

# When task done, push and create PR
git push -u origin task/<N>-<short-name>
gh pr create --title "Task <N>: <name>" --body "..." --base main
```

Merge pattern: **Squash merge** on GitHub (keeps main history clean).

### Step 18: Update PROGRESS.md

Mark Task 1 complete:

```markdown
## Completed Tasks Log

| Task | Commit | Date       | Notes                       |
| ---- | ------ | ---------- | --------------------------- |
| 1    | <sha>  | 2026-04-XX | Initial setup + GitHub repo |
```

---

## Task 2: Design Tokens

**Files:**

- Create: `tailwind.config.js`
- Create: `src/shared/theme/tokens.ts`
- Create: `global.css`
- Create: `src/shared/theme/__tests__/tokens.test.ts`

### Step 1: `tailwind.config.js`

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#F59E0B',
          light: '#FCD34D',
          dark: '#D97706',
          50: '#FFFBEB',
        },
        text: {
          primary: '#0F172A',
          secondary: '#475569',
          tertiary: '#94A3B8',
          inverse: '#FFFFFF',
        },
        bg: {
          base: '#FFFFFF',
          elevated: '#FFFFFF',
          subtle: '#F8FAFC',
          muted: '#F1F5F9',
        },
        border: {
          DEFAULT: '#E2E8F0',
          subtle: '#F1F5F9',
          focus: '#F59E0B',
        },
        success: '#22C55E',
        error: '#EF4444',
        info: '#3B82F6',
      },
      fontFamily: {
        sans: ['Pretendard-Regular'],
        medium: ['Pretendard-Medium'],
        semibold: ['Pretendard-SemiBold'],
        bold: ['Pretendard-Bold'],
      },
      fontSize: {
        display: ['28px', { lineHeight: '34px', fontWeight: '700' }],
        'heading-lg': ['22px', { lineHeight: '29px', fontWeight: '700' }],
        'heading-md': ['18px', { lineHeight: '23px', fontWeight: '600' }],
        'heading-sm': ['16px', { lineHeight: '22px', fontWeight: '600' }],
        body: ['15px', { lineHeight: '23px', fontWeight: '400' }],
        'body-sm': ['13px', { lineHeight: '20px', fontWeight: '400' }],
        caption: ['11px', { lineHeight: '15px', fontWeight: '500' }],
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0,0,0,0.05)',
        md: '0 4px 6px -1px rgba(0,0,0,0.07)',
        lg: '0 10px 15px -3px rgba(0,0,0,0.08)',
        xl: '0 20px 25px -5px rgba(0,0,0,0.10)',
      },
    },
  },
  plugins: [],
};
```

### Step 2: `src/shared/theme/tokens.ts`

```ts
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
```

### Step 3: `global.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### Step 4: Write test

```ts
// src/shared/theme/__tests__/tokens.test.ts
import { colors, spacing, radius, ANIMATION } from '../tokens';

describe('theme tokens', () => {
  it('exposes amber accent color', () => {
    expect(colors.accent.DEFAULT).toBe('#F59E0B');
  });
  it('exposes consistent spacing scale', () => {
    expect(spacing.lg).toBe(16);
  });
  it('exposes stagger timing for animations', () => {
    expect(ANIMATION.stagger).toBe(60);
  });
});
```

### Step 5: Run test

```bash
pnpm test src/shared/theme
```

Expected: 3 tests pass.

### Step 6: Commit

```bash
git add tailwind.config.js src/shared/theme/ global.css
git commit -m "feat: add design tokens (colors, typography, spacing)"
```

---

## Task 3: Pretendard Font Setup

**Files:**

- Download: 4 Pretendard OTF files to `assets/fonts/`
- Create: `src/shared/theme/fonts.ts`

### Step 1: Download Pretendard

Manually download from https://github.com/orioncactus/pretendard/releases:

- `Pretendard-Regular.otf`
- `Pretendard-Medium.otf`
- `Pretendard-SemiBold.otf`
- `Pretendard-Bold.otf`

Place in `assets/fonts/`.

### Step 2: `src/shared/theme/fonts.ts`

```ts
import { useFonts } from 'expo-font';

export function useAppFonts() {
  return useFonts({
    'Pretendard-Regular': require('../../../assets/fonts/Pretendard-Regular.otf'),
    'Pretendard-Medium': require('../../../assets/fonts/Pretendard-Medium.otf'),
    'Pretendard-SemiBold': require('../../../assets/fonts/Pretendard-SemiBold.otf'),
    'Pretendard-Bold': require('../../../assets/fonts/Pretendard-Bold.otf'),
  });
}
```

### Step 3: Commit

```bash
git add assets/fonts/ src/shared/theme/fonts.ts
git commit -m "feat: add Pretendard font"
```

---

## Task 4: Supabase Client + Database Types + Query Key Factory

**Files:**

- Create: `src/shared/lib/supabase.ts`
- Create: `src/shared/lib/query-client.ts`
- Create: `src/shared/types/database.ts`
- Create: `src/shared/types/__tests__/database.test.ts`

### Step 1: Write test first

```ts
// src/shared/types/__tests__/database.test.ts
import type {
  Gym,
  GymMachine,
  MachinePhoto,
  Brand,
  Category,
  User,
  MachineTemplate,
} from '../database';

describe('Database types', () => {
  it('Gym has optional operating info and required timestamps', () => {
    const gym: Gym = {
      id: 'uuid',
      name: 'Test',
      address: 'Seoul',
      latitude: 37.5,
      longitude: 127.0,
      phone: null,
      operating_hours: null,
      day_pass_price: null,
      is_verified: true,
      last_verified_at: '2026-03-15',
      created_at: '2026-03-15',
      updated_at: '2026-03-15',
    };
    expect(gym.phone).toBeNull();
  });

  it('GymMachine has quantity defaulting to 1+', () => {
    const gm: GymMachine = {
      id: 'uuid',
      gym_id: 'g',
      template_id: 't',
      quantity: 2,
      is_custom: false,
      custom_name: null,
      last_verified_at: null,
      created_at: '2026-03-15',
    };
    expect(gm.quantity).toBeGreaterThanOrEqual(1);
  });

  it('MachinePhoto user_id is nullable for Phase 1 seed', () => {
    const p: MachinePhoto = {
      id: 'uuid',
      gym_machine_id: 'gm',
      user_id: null,
      photo_url: 'https://...',
      created_at: '2026-03-10',
      upvote_count: 0,
    };
    expect(p.user_id).toBeNull();
  });
});
```

### Step 2: Implement types

```ts
// src/shared/types/database.ts
export type LoadingType = 'pin' | 'plate';
export type UserRole = 'admin' | 'user' | 'owner';
export type ReportStatus = 'pending' | 'reviewed' | 'dismissed' | 'actioned';

export interface User {
  id: string;
  email: string;
  nickname: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

// NOTE: This `Gym` type describes the `search_gyms_in_bounds` RPC output
// (lat/lng already decomposed). The raw `gyms` table stores `location
// geography(Point)` instead — see architecture-design.md §6.
export interface Gym {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string | null;
  operating_hours: string | null;
  day_pass_price: number | null;
  is_verified: boolean;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Brand {
  id: string;
  name: string;
}
export interface Category {
  id: string;
  name: string;
}

export interface MachineTemplate {
  id: string;
  brand_id: string;
  category_id: string;
  name: string;
  loading_type: LoadingType;
  is_approved: boolean;
  created_at: string;
}

export interface GymMachine {
  id: string;
  gym_id: string;
  template_id: string;
  quantity: number;
  is_custom: boolean;
  custom_name: string | null;
  last_verified_at: string | null;
  created_at: string;
}

export interface MachinePhoto {
  id: string;
  gym_machine_id: string;
  user_id: string | null;
  photo_url: string;
  created_at: string;
  upvote_count: number;
}

// Joined types
export interface GymWithMachineCount extends Gym {
  machine_count: number;
}

export interface GymMachineWithDetails extends GymMachine {
  template: MachineTemplate & { brand: Brand; category: Category };
  photos: MachinePhoto[];
}

// Query types
export interface MapBounds {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

export interface SearchFilters {
  brandId: string | null;
  categoryId: string | null;
  loadingType: LoadingType | null;
}
```

### Step 3: Supabase client

```ts
// src/shared/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV();

const mmkvStorage = {
  getItem: (key: string) => storage.getString(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
};

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      storage: mmkvStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
```

### Step 4: Query client

```ts
// src/shared/lib/query-client.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 min
      retry: 2,
      refetchOnWindowFocus: false, // RN doesn't have window focus
    },
  },
});
```

### Step 5: Query Key Factory per feature

Create the files (empty skeletons for now, populated as services are built):

```ts
// src/features/map/query-keys.ts
import type { MapBounds, SearchFilters } from '@/shared/types/database';

export const mapKeys = {
  all: ['map'] as const,
  brands: () => [...mapKeys.all, 'brands'] as const,
  categories: () => [...mapKeys.all, 'categories'] as const,
  gymSearch: (bounds: MapBounds | null, filters: SearchFilters) =>
    [...mapKeys.all, 'search', bounds, filters] as const,
};
```

```ts
// src/features/gym/query-keys.ts
export const gymKeys = {
  all: ['gym'] as const,
  details: () => [...gymKeys.all, 'detail'] as const,
  detail: (gymId: string) => [...gymKeys.details(), gymId] as const,
  machines: (gymId: string) => [...gymKeys.detail(gymId), 'machines'] as const,
};
```

```ts
// src/features/photo/query-keys.ts
export const photoKeys = {
  all: ['photo'] as const,
  list: (gymMachineId: string) => [...photoKeys.all, 'list', gymMachineId] as const,
  detail: (photoId: string) => [...photoKeys.all, 'detail', photoId] as const,
};
```

### Step 6: Run tests + commit

```bash
pnpm test src/shared/types
git add src/shared/ src/features/*/query-keys.ts
git commit -m "feat: add supabase client, database types, query key factory"
```

---

## Task 5: Upload Real Seed Photos (Manual)

**You need to do this step manually.**

### Step 1: Take 5-10 real gym machine photos

Any gym nearby. Just machines with visible brand logos (Panatta, Hammer Strength, etc.).

### Step 2: Upload via Supabase Dashboard

1. Supabase → Storage → `machine-photos` bucket
2. Create folder: `seed/`
3. Upload photos with descriptive names: `panatta-high-row.webp`, `hammer-lat-pulldown.webp`, etc.

### Step 3: Get public URLs

For each file, right-click → "Copy URL". Format: `https://{project}.supabase.co/storage/v1/object/public/machine-photos/seed/{filename}`

### Step 4: Update DB

Run in Supabase SQL Editor (replace URLs with real ones):

```sql
UPDATE machine_photos SET photo_url = 'https://ofybwpwicjjtokwqxuxe.supabase.co/storage/v1/object/public/machine-photos/seed/panatta-high-row.webp' WHERE id = 'f0010001-0000-0000-0000-000000000001';
UPDATE machine_photos SET photo_url = 'https://...' WHERE id = 'f0010001-0000-0000-0000-000000000002';
-- ... repeat for all seed photo IDs
```

### Verify

```sql
SELECT id, photo_url FROM machine_photos;
```

All URLs should be real Supabase Storage URLs.

---

## Task 6: Shared UI Components

TDD each. Commit after each sub-task.

### Task 6.1: Button

**Files:**

- `src/shared/components/Button.tsx`
- `src/shared/components/__tests__/Button.test.tsx`

**Test first:**

```tsx
// Button.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '../Button';

describe('Button', () => {
  it('renders label', () => {
    const { getByText } = render(<Button label="확인" onPress={() => {}} />);
    expect(getByText('확인')).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByText } = render(<Button label="확인" onPress={onPress} />);
    fireEvent.press(getByText('확인'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows loading state and disables press', () => {
    const onPress = jest.fn();
    const { getByTestId, queryByText } = render(
      <Button label="확인" onPress={onPress} loading testID="btn" />,
    );
    expect(queryByText('확인')).toBeNull();
    fireEvent.press(getByTestId('btn'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
```

**Implementation:**

```tsx
// Button.tsx
import { Pressable, Text, ActivityIndicator } from 'react-native';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'md' | 'sm';
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  testID,
}: ButtonProps) {
  const base = 'items-center justify-center rounded-md';
  const heights = { md: 'h-12 px-6', sm: 'h-9 px-4' };
  const variants = {
    primary: 'bg-accent',
    secondary: 'bg-bg-muted',
    ghost: 'bg-transparent',
  };
  const textColors = {
    primary: 'text-text-inverse',
    secondary: 'text-text-primary',
    ghost: 'text-accent',
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      testID={testID}
      className={`${base} ${heights[size]} ${variants[variant]} ${disabled ? 'opacity-50' : ''}`}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#fff' : '#F59E0B'} />
      ) : (
        <Text className={`font-semibold ${textColors[variant]}`}>{label}</Text>
      )}
    </Pressable>
  );
}
```

### Task 6.2: Chip

**Files:**

- `src/shared/components/Chip.tsx`
- `src/shared/components/__tests__/Chip.test.tsx`

Filter chip with selected/unselected states. Animated background via reanimated `withTiming`. 36px height. Horizontal scroll friendly.

### Task 6.3: Card

**Files:**

- `src/shared/components/Card.tsx`

White bg, rounded-lg, shadow-md, configurable padding. Accepts optional `onPress`.

### Task 6.4: Skeleton

**Files:**

- `src/shared/components/Skeleton.tsx`
- `src/shared/components/__tests__/Skeleton.test.tsx`

Animated shimmer via reanimated (`withRepeat` + `withTiming` on opacity). Rectangle + circle variants.

### Task 6.5: EmptyState

**Files:**

- `src/shared/components/EmptyState.tsx`

Props: `icon` (name from @expo/vector-icons), `title`, `description`, optional `action` button.

### Task 6.6: ErrorBoundary

**Files:**

- `src/shared/components/ErrorBoundary.tsx`

Wrap `react-error-boundary` with default fallback UI (error message + retry button). Used at root.

**Commit after each sub-task.**

---

## Task 7: Data Layer — Services + Hooks

TDD each. Mock Supabase in tests.

### Task 7.1: Brands + Categories (simple)

**Files:**

- `src/features/map/services/brands.ts` → `fetchBrands()`
- `src/features/map/services/categories.ts` → `fetchCategories()`
- `src/features/map/hooks/useBrands.ts`
- `src/features/map/hooks/useCategories.ts`
- Tests for each

Hook pattern:

```ts
// useBrands.ts
import { useQuery } from '@tanstack/react-query';
import { mapKeys } from '../query-keys';
import { fetchBrands } from '../services/brands';

export function useBrands() {
  return useQuery({
    queryKey: mapKeys.brands(),
    queryFn: fetchBrands,
    staleTime: Infinity, // static data
  });
}
```

### Task 7.2: Gym Search

**Files:**

- `src/features/map/services/gym-search.ts`
- `src/features/map/hooks/useGymSearch.ts`
- `src/features/map/hooks/useFilters.ts` (local filter state)

```ts
// gym-search.ts
import { supabase } from '@/shared/lib/supabase';
import type { MapBounds, SearchFilters, GymWithMachineCount } from '@/shared/types/database';

export async function searchGymsInBounds(
  bounds: MapBounds,
  filters: SearchFilters,
): Promise<GymWithMachineCount[]> {
  const { data, error } = await supabase.rpc('search_gyms_in_bounds', {
    min_lat: bounds.minLat,
    min_lng: bounds.minLng,
    max_lat: bounds.maxLat,
    max_lng: bounds.maxLng,
    brand_filter: filters.brandId,
    category_filter: filters.categoryId,
    loading_filter: filters.loadingType,
  });
  if (error) throw new Error(error.message);
  return data ?? [];
}
```

```ts
// useGymSearch.ts
import { useQuery } from '@tanstack/react-query';
import { mapKeys } from '../query-keys';
import { searchGymsInBounds } from '../services/gym-search';
import type { MapBounds, SearchFilters } from '@/shared/types/database';

export function useGymSearch(bounds: MapBounds | null, filters: SearchFilters) {
  return useQuery({
    queryKey: mapKeys.gymSearch(bounds, filters),
    queryFn: () => searchGymsInBounds(bounds!, filters),
    enabled: bounds !== null,
    staleTime: 1000 * 60 * 5,
  });
}
```

### Task 7.3: Gym Detail + Machines

**Files:**

- `src/features/gym/services/gym-detail.ts`
- `src/features/gym/hooks/useGymMachines.ts`

```ts
// gym-detail.ts
import { supabase } from '@/shared/lib/supabase';
import type { GymMachineWithDetails } from '@/shared/types/database';

export async function getGymMachines(gymId: string): Promise<GymMachineWithDetails[]> {
  const { data, error } = await supabase
    .from('gym_machines')
    .select(
      `
      *,
      template:machine_templates (
        *,
        brand:brands (*),
        category:categories (*)
      ),
      photos:machine_photos (*)
    `,
    )
    .eq('gym_id', gymId)
    .order('template_id');

  if (error) throw new Error(error.message);
  return data as GymMachineWithDetails[];
}
```

### Task 7.4: Photo List

**Files:**

- `src/features/photo/services/photo-list.ts`
- `src/features/photo/hooks/useMachinePhotos.ts`

Sorted by `upvote_count` desc.

### Test pattern for services (example)

```ts
// gym-search.test.ts
import { searchGymsInBounds } from '../gym-search';

jest.mock('@/shared/lib/supabase', () => ({
  supabase: { rpc: jest.fn() },
}));

import { supabase } from '@/shared/lib/supabase';

describe('searchGymsInBounds', () => {
  it('calls supabase RPC with correct params', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: [], error: null });

    await searchGymsInBounds(
      { minLat: 37.48, minLng: 127.02, maxLat: 37.5, maxLng: 127.04 },
      { brandId: 'b1', categoryId: null, loadingType: 'plate' },
    );

    expect(supabase.rpc).toHaveBeenCalledWith('search_gyms_in_bounds', {
      min_lat: 37.48,
      min_lng: 127.02,
      max_lat: 37.5,
      max_lng: 127.04,
      brand_filter: 'b1',
      category_filter: null,
      loading_filter: 'plate',
    });
  });

  it('throws on supabase error', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({
      data: null,
      error: { message: 'db error' },
    });

    await expect(
      searchGymsInBounds(
        { minLat: 0, minLng: 0, maxLat: 0, maxLng: 0 },
        { brandId: null, categoryId: null, loadingType: null },
      ),
    ).rejects.toThrow('db error');
  });
});
```

Commit after each sub-task.

---

## Task 8: Location Hooks

**Files:**

- `src/shared/hooks/useCurrentLocation.ts`
- `src/shared/hooks/usePermissionStatus.ts`

```ts
// useCurrentLocation.ts
import { useEffect, useState } from 'react';
import * as Location from 'expo-location';

interface Coordinate {
  latitude: number;
  longitude: number;
}

const GANGNAM_STATION: Coordinate = { latitude: 37.4979, longitude: 127.0276 };

export function useCurrentLocation() {
  const [location, setLocation] = useState<Coordinate | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('위치 권한이 거부되었습니다');
        setLocation(GANGNAM_STATION);
        return;
      }
      try {
        const current = await Location.getCurrentPositionAsync({});
        setLocation({
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        });
      } catch {
        setLocation(GANGNAM_STATION);
      }
    })();
  }, []);

  return { location, error };
}
```

Test by mocking `expo-location`.

---

## Task 9: Expo Router Setup

**Files:**

- Create: `app/_layout.tsx` (root: providers, fonts, splash)
- Create: `app/(tabs)/_layout.tsx` (tab navigator)
- Create: `app/(tabs)/index.tsx` (Map tab entry)
- Create: `app/(tabs)/me.tsx` (My Page stub)
- Create: `app/gym/[id]/machine/[machineId].tsx` (photo gallery route)
- Create: `app/photo/[id].tsx` (photo detail modal)

### Step 1: `app/_layout.tsx`

```tsx
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { queryClient } from '@/shared/lib/query-client';
import { useAppFonts } from '@/shared/theme/fonts';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import '../global.css';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useAppFonts();

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="gym/[id]/machine/[machineId]" />
            <Stack.Screen
              name="photo/[id]"
              options={{ presentation: 'modal', contentStyle: { backgroundColor: '#000' } }}
            />
          </Stack>
        </QueryClientProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
```

### Step 2: `app/(tabs)/_layout.tsx`

```tsx
import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#F59E0B',
        tabBarInactiveTintColor: '#94A3B8',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color, size }) => <MaterialIcons name="map" size={size} color={color} />,
          tabBarLabel: '지도',
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="person" size={size} color={color} />
          ),
          tabBarLabel: '마이',
        }}
      />
    </Tabs>
  );
}
```

### Step 3: `app/(tabs)/me.tsx` (Phase 2 stub)

```tsx
import { View, Text } from 'react-native';

export default function MePage() {
  return (
    <View className="flex-1 items-center justify-center bg-bg-base">
      <Text className="text-heading-md text-text-primary">마이페이지</Text>
      <Text className="text-body-sm text-text-secondary mt-2">Phase 2에서 제공 예정</Text>
    </View>
  );
}
```

### Step 4: `app/(tabs)/index.tsx` (Map tab stub for now)

```tsx
import { View, Text } from 'react-native';

export default function MapScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-bg-base">
      <Text className="text-heading-md text-text-primary">지도 화면</Text>
      <Text className="text-body-sm text-text-secondary mt-2">Task 13에서 구현</Text>
    </View>
  );
}
```

This stub is replaced in Task 13 when Naver Maps SDK integrates.

### Step 5: Other route stubs

Create `app/gym/[id]/machine/[machineId].tsx` and `app/photo/[id].tsx` as minimal stubs. They'll be fleshed out in Tasks 11 and 12.

### Step 6: Splash image

Use a simple amber-tinted logo placeholder at `assets/splash.png` (can be upgraded later).

### Step 7: Verify app runs

```bash
pnpm start
```

Tabs should show, stubs should render, fonts should load.

### Step 8: Commit

```bash
git commit -m "feat: expo router layout with tabs and stub screens"
```

---

## Task 9.5: Maestro E2E Setup

Set up Maestro for 3-tier E2E testing strategy:

- **Smoke** — runs on every PR (< 30s)
- **Relevant flow** — runs when feature changes
- **Full suite** — runs at Phase 1 completion (Task 15)

### Step 1: Install Maestro CLI

```bash
# macOS
curl -Ls "https://get.maestro.mobile.dev" | bash
```

Verify: `maestro --version`

### Step 2: Create directory structure

```bash
mkdir -p .maestro/flows
```

### Step 3: Smoke test (fast, runs every PR)

```yaml
# .maestro/flows/smoke.yaml
appId: com.ironspot.app
---
- launchApp
- assertVisible: '지도' # tab bar label
- assertNotVisible: 'Error'
```

### Step 4: Feature flows (Phase 1 scope)

Create stubs that will be fleshed out as features are built:

```yaml
# .maestro/flows/gym-search.yaml
appId: com.ironspot.app
---
- launchApp
- tapOn: '이 지역 재검색'
- assertVisible: 'gyms nearby'
```

```yaml
# .maestro/flows/gym-detail.yaml
appId: com.ironspot.app
---
- launchApp
- tapOn: '이 지역 재검색'
- tapOn:
    index: 0
    text: 'Fitness Factory'
- assertVisible: 'High Row'
```

```yaml
# .maestro/flows/photo-gallery.yaml
appId: com.ironspot.app
---
- launchApp
- tapOn: '이 지역 재검색'
- tapOn: 'Fitness Factory'
- tapOn: 'High Row'
- assertVisible: 'Best Cut'
```

```yaml
# .maestro/flows/photo-detail.yaml
appId: com.ironspot.app
---
- launchApp
- tapOn: '이 지역 재검색'
- tapOn: 'Fitness Factory'
- tapOn: 'High Row'
- tapOn:
    index: 0
    type: 'Image'
- assertVisible: 'Upvote'
```

### Step 5: Workspace config for Full suite

```yaml
# .maestro/config.yaml
flows:
  - flows/smoke.yaml
  - flows/gym-search.yaml
  - flows/gym-detail.yaml
  - flows/photo-gallery.yaml
  - flows/photo-detail.yaml
```

### Step 6: Add pnpm scripts

Update `package.json`:

```json
{
  "scripts": {
    "e2e:smoke": "maestro test .maestro/flows/smoke.yaml",
    "e2e:flow": "maestro test",
    "e2e:all": "maestro test .maestro"
  }
}
```

Usage:

- `pnpm e2e:smoke` — 30s smoke check
- `pnpm e2e:flow .maestro/flows/gym-detail.yaml` — single flow
- `pnpm e2e:all` — full suite

### Step 7: E2E execution strategy

Task-specific E2E execution is defined in `docs/harness/e2e-strategy.md`. The agent must reference this document before each Task completion.

Do not embed the mapping in `/verify` — keep `/verify` project-agnostic.

### Step 8: Commit

```bash
git add .maestro/ package.json
git commit -m "feat: maestro e2e setup with smoke + flow tests"
```

---

## Task 10: Gym Bottom Sheet + Cards (no map yet)

Build the gym list/detail UI independently of the map. Can be tested in isolation by using a mock gym list.

**Files:**

- `src/features/gym/components/GymBottomSheet.tsx`
- `src/features/gym/components/GymCard.tsx`
- `src/features/gym/components/GymDetail.tsx`
- `src/features/gym/components/MachineList.tsx`
- Tests for each

TDD each. Use FlashList for gym list.

### GymCard layout

- 80x80 thumbnail (rounded-xl) on left
- Gym name (heading-sm), distance with map-pin icon, brand summary chips (amber-50 bg, amber-600 text)
- `last_verified_at` bottom-right (text-tertiary, body-sm)
- FadeInUp entering animation with stagger delay

### GymDetail layout

- Header: gym name (heading-lg), address, phone (if set), operating hours (if set)
- `Last verified: ...` chip
- Body: collapsible brand sections, each with category-sorted machines
- Machine row: name + quantity badge (if >=2) + photo count icon

### Commit after each.

---

## Task 11: Photo Gallery + Detail

**Files:**

- `src/features/photo/components/PhotoGrid.tsx`
- `app/gym/[id]/machine/[machineId].tsx` (photo gallery screen)
- `app/photo/[id].tsx` (photo detail modal)

### Photo gallery screen

- Header: machine name + gym name
- Best cut pinned at top (amber-50 banner "Best Cut")
- 3-column grid, stagger fade-in
- FAB "Add Photo" → tapping shows toast "Phase 2에서 제공 예정"
- Pull-to-refresh

### Photo detail screen

- Dark modal background
- Pinch-to-zoom + double-tap zoom (gesture-handler)
- Swipe left/right between photos of same machine (use `FlatList` horizontal with `pagingEnabled`)
- Footer: heart + upvote count + date + uploader
- Report button top-right (disabled Phase 1)

### Commit after each.

---

## Task 12: Empty States + Loading States

Wire up across the app:

- **Map empty**: `<EmptyState icon="search-off" title="조건에 맞는 헬스장이 없어요" description="필터를 조정해보세요" action={<Button label="필터 초기화" onPress={clearFilters} />} />`
- **Gym list skeleton**: show 3 GymCard skeletons while loading
- **Photo gallery empty**: `<EmptyState icon="photo-camera" title="아직 사진이 없어요" description="첫 번째 사진을 올려보세요!" />`
- **Offline banner**: reanimated top slide-in banner when `NetInfo.isConnected` is false

Commit each.

---

## Task 13: Map Screen (Naver Maps)

⚠️ **Requires Naver Cloud Maps Client ID in `.env`.**

### Step 1: Verify Naver Maps SDK renders

Minimal smoke test before building the full UI:

```tsx
// Temporary in app/(tabs)/index.tsx
import { NaverMapView } from '@mj-studio/react-native-naver-map';

export default function MapScreen() {
  return <NaverMapView style={{ flex: 1 }} />;
}
```

Run app. If white/gray screen or crash, SDK incompatibility — STOP and evaluate alternatives.

### Step 2: Build MapScreen

**Files:**

- `src/features/map/components/MapScreen.tsx`
- `src/features/map/components/GymMarker.tsx`
- `src/features/map/components/SearchAreaButton.tsx`
- `src/features/map/components/FilterBar.tsx`

MapScreen combines:

- Top bar: search stub + filter chips (FilterBar)
- Full-screen NaverMapView
- Current location centered on mount
- "이 지역 재검색" floating button when map has moved
- GymBottomSheet docked at bottom

### Step 3: Custom GymMarker

Reanimated overlay matching design tokens:

- Default: 32x28, amber-500, white count text, rounded-lg, triangle pointer
- Selected: 40x34, amber-600, scale(1.15) via withSpring
- Filter-mismatch (count 0): slate-300

### Step 4: Stagger entrance

When `useGymSearch` returns, reveal markers one by one:

```tsx
useEffect(() => {
  if (!gyms) return;
  setVisibleMarkers([]);
  gyms.forEach((gym, i) => {
    setTimeout(() => setVisibleMarkers((v) => [...v, gym.id]), i * 60);
  });
}, [gyms]);
```

### Step 5: Commit

```bash
git commit -m "feat: map screen with naver maps and custom markers"
```

---

## Task 14: Animations Polish

Apply remaining animations from UI design:

- Filter chip color transitions (Chip already does this in Task 6)
- Gym card FadeInUp on list appear (already in Task 10)
- Photo grid stagger (already in Task 11)
- Marker stagger (already in Task 13)
- Verify screen transitions match ui-design.md table

Run the app, inspect each animation. Fix timing issues.

---

## Task 15: Verification

Full manual smoke test:

1. App launch → splash → location permission → map at current location
2. Tap "이 지역 재검색" → markers appear staggered
3. Tap filter chip → markers update with animation
4. Tap gym card (Bottom Sheet half) → sheet expands to full with gym detail
5. Tap machine row → Photo Gallery screen
6. Best cut visible, grid stagger-in works
7. Tap photo → Photo Detail modal, pinch-zoom works, swipe between photos
8. Back navigation at every level
9. Toggle airplane mode → offline banner appears, cached data shown
10. My Page tab works (shows stub)

Fix any issues. Final commit:

```bash
git commit -m "feat: complete phase 1 read-only MVP"
```

---

## Out of Phase 1 Scope (Reference)

These are in design docs but **not in Phase 1**:

- Login screen (Phase 2)
- Photo upload flow (Phase 2)
- My Page real content (Phase 2; stub only in Phase 1)
- Account settings (Phase 2)
- NL search (Phase 3)
- Haptic feedback (Phase 2)
- Push notifications (post-launch)
- Deep linking polish (post-launch; Expo Router gives us basics)

---

## Phase 2 Overview (detailed plan after Phase 1 completion)

See `docs/plans/phase-2/README.md` for scope.

## Phase 3 Overview

See `docs/plans/phase-3/README.md` for scope.
