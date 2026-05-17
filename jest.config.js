process.env.EXPO_PUBLIC_API_URL = 'http://localhost:8080';
// Task 47 introduces components (OwnerActivityWidget, GymOwnerEntry) that import
// the Orval owner hook → api-client → env. The env zod schema rejects empty
// values, so tests in unrelated suites fail at module evaluation when they
// transitively import these components. Supply placeholder values; tests that
// actually exercise auth still mock supabase explicitly.
process.env.EXPO_PUBLIC_SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://localhost:54321';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'test-anon-key';
process.env.EXPO_PUBLIC_NAVER_MAP_CLIENT_ID =
  process.env.EXPO_PUBLIC_NAVER_MAP_CLIENT_ID ?? 'test-naver-id';

module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|@sentry/.*|native-base|react-native-svg|@mj-studio/react-native-naver-map|ky))',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@mj-studio/react-native-naver-map$': '<rootDir>/src/test/mocks/naver-map.ts',
    '^react-native-mmkv$': '<rootDir>/src/test/mocks/react-native-mmkv.ts',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/__tests__/**',
    '!src/**/types.ts',
    '!src/**/index.ts',
    // NaverMapView + NaverMapMarkerOverlay chain crashes Jest (OOM); covered by Maestro E2E
    '!src/features/map/components/MapScreen.tsx',
    '!src/features/map/components/GymMarker.tsx',
    '!src/shared/lib/api-client.ts',
    '!src/shared/generated/**',
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
