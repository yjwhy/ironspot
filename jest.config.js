process.env.EXPO_PUBLIC_API_URL = 'http://localhost:8080';

module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|@sentry/.*|native-base|react-native-svg|@mj-studio/react-native-naver-map))',
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
