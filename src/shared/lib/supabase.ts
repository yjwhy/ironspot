import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

import { env } from './env';

// Security task #14 — Supabase session is sensitive: the JWT lets anyone
// who reads it impersonate the user for ~1h, and the refresh token can
// mint new JWTs indefinitely until the user logs out. MMKV stores values
// in plaintext under the app's sandboxed data directory; on iOS a backed-
// up device or a jailbroken phone exposes that directory in clear. On
// Android the data is similarly exposed to a rooted phone or to
// allowBackup-enabled adb pulls.
//
// expo-secure-store moves the session to:
//   - iOS Keychain (kSecAttrAccessibleAfterFirstUnlock by default)
//   - Android Keystore + EncryptedSharedPreferences
// Both back the value with hardware-backed encryption (Secure Enclave /
// StrongBox where available) and exclude it from iCloud / device backups.
//
// Other MMKV stores in the app (search recents, upload guidance flag) are
// non-sensitive and stay on MMKV for performance + sync API. Only the
// Supabase auth storage moves.

const secureStorageAdapter = {
  // Supabase's SupportedStorage accepts async returns, so we hand back the
  // expo-secure-store promises directly.
  getItem(key: string): Promise<string | null> {
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value);
  },
  async removeItem(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient(
  env.EXPO_PUBLIC_SUPABASE_URL,
  env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      storage: secureStorageAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
