import { createClient } from '@supabase/supabase-js';
import { MMKV } from 'react-native-mmkv';

import { env } from './env';

// Security task #14 — Supabase session is sensitive: the JWT can
// impersonate the user for ~1h and the refresh token mints new JWTs
// until logout. The plan is to move the session into expo-secure-store
// (iOS Keychain / Android Keystore) which is hardware-backed and
// excluded from device backups, instead of MMKV's plaintext on-disk
// storage.
//
// Status: blocked on a dev-client rebuild. expo-secure-store's native
// module ('ExpoSecureStore') is missing from the current dev client,
// so even `import * as SecureStore from 'expo-secure-store'` throws
// at module-init time and crashes login. The package stays installed
// (see package.json + expo-build-properties already wires native
// modules). Once a new dev client is built (pnpm expo prebuild +
// pnpm expo run:ios, or EAS build) the import resolves and the
// secure-store swap below can re-land. See the audit doc
// (docs/security/audit-2026-05.md) #14 section for the secure-store
// adapter code we wrote and reverted.
//
// Until then we ship MMKV with a clear "not hardware-backed" note so
// no one assumes the prior swap is live.

const storage = new MMKV({ id: 'supabase-auth' });

const mmkvStorage = {
  getItem: (key: string) => storage.getString(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
  removeItem: (key: string) => {
    storage.delete(key);
  },
};

export const supabase = createClient(
  env.EXPO_PUBLIC_SUPABASE_URL,
  env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      storage: mmkvStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
