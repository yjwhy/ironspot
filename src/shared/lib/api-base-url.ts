import Constants from 'expo-constants';

import { env } from './env';

const PROD_URL = 'https://ironspot.onrender.com';

/**
 * Backend base URL for the Spring Boot API.
 *
 * Branching rules:
 * - **Mac simulator in dev mode**: respects `env.EXPO_PUBLIC_API_URL`, so
 *   `pnpm dev:local` (.env value) and `pnpm dev:prod` (shell overlay) actually
 *   switch the backend the simulator hits.
 * - **Real device (iPhone) in dev mode**: always {@link PROD_URL}. Hardcoded
 *   safety net — running Metro in `dev:local` mode while the iPhone is on the
 *   same WiFi must NOT make the phone reach for a Mac-local Spring Boot it
 *   has no route to. The iPhone always sees prod regardless of the Mac
 *   developer's current toggle.
 * - **Production builds (App Store / TestFlight / EAS production profile)**:
 *   always {@link PROD_URL}. `!__DEV__` triggers in any non-dev bundle, so
 *   even if EAS preview accidentally inherits an EXPO_PUBLIC_API_URL=local
 *   value it'll be ignored.
 *
 * Detection:
 * - `Constants.isDevice` is `true` on real iOS/Android devices, `false` on
 *   simulators / emulators. Stable since SDK 49.
 * - `__DEV__` is a Metro-injected global that's `false` in any production
 *   bundle (release configuration, EAS production profile).
 */
export const API_URL: string = Constants.isDevice || !__DEV__ ? PROD_URL : env.EXPO_PUBLIC_API_URL;
