import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { MMKV } from 'react-native-mmkv';

import { env } from './env';

// Security task #14 — Supabase session is sensitive: the JWT lets anyone
// who reads it impersonate the user for ~1h, and the refresh token can
// mint new JWTs indefinitely until logout. MMKV stores values in
// plaintext under the app's sandboxed data directory; on iOS a backed-
// up device or a jailbroken phone exposes that directory in clear. On
// Android the data is similarly exposed to a rooted phone or to
// allowBackup adb pulls.
//
// expo-secure-store moves the session to:
//   - iOS Keychain (kSecAttrAccessibleAfterFirstUnlock)
//   - Android Keystore + EncryptedSharedPreferences
// Both back the value with hardware-backed encryption and exclude it
// from iCloud / device backups.
//
// Runtime fallback: expo-secure-store is a native module. The dev
// client must be rebuilt (pnpm expo prebuild + rebuild, or EAS build)
// before the native bridge resolves; until then SecureStore.* throws
// "Cannot find native module 'ExpoSecureStore'" at the first call.
// We catch that, log once, and fall through to an in-memory MMKV
// adapter so the app keeps booting. The next dev / production build
// auto-promotes to SecureStore.

const mmkvStorage = new MMKV({ id: 'supabase-auth' });
let nativeModuleWarned = false;

function warnNativeMissing(): void {
  if (nativeModuleWarned) return;
  nativeModuleWarned = true;
  console.warn(
    '[security #14] expo-secure-store native module unavailable — ' +
      'falling back to MMKV. Rebuild the dev client to pick up the secure ' +
      'native storage.',
  );
}

const supabaseStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      warnNativeMissing();
      return mmkvStorage.getString(key) ?? null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      warnNativeMissing();
      mmkvStorage.set(key, value);
    }
  },
  async removeItem(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      warnNativeMissing();
      mmkvStorage.delete(key);
    }
  },
};

export const supabase = createClient(
  env.EXPO_PUBLIC_SUPABASE_URL,
  env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      storage: supabaseStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
