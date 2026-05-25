import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

import { env } from './env';

// Security task #14 — Supabase session lives in the OS secure enclave
// instead of MMKV's plaintext on-disk storage.
//
// Why this matters: the JWT can impersonate the user for ~1h and the
// refresh token mints new JWTs indefinitely until logout. MMKV stores
// values in plaintext under the app's sandboxed data directory; on iOS
// a backed-up device or a jailbroken phone exposes that directory in
// clear, and on Android a rooted phone or allowBackup adb pull does
// the same.
//
// expo-secure-store moves the session to:
//   - iOS Keychain (kSecAttrAccessibleAfterFirstUnlock)
//   - Android Keystore + EncryptedSharedPreferences
// Both back the value with hardware-backed encryption (Secure Enclave /
// StrongBox where available) and exclude it from iCloud / device
// backups.
//
// Native-module dependency: this import requires that expo-secure-store
// be linked into the running app binary. The dev client and EAS builds
// pick it up via the expo-build-properties plugin in app.json. The
// "Cannot find native module 'ExpoSecureStore'" error indicates an old
// dev client that predates the prebuild — rebuild with
// `pnpm expo prebuild --clean && pnpm expo run:ios`.

const secureStorageAdapter = {
  // Supabase's SupportedStorage interface accepts async returns, so we
  // hand back the expo-secure-store promises directly.
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
      // Security task #16: PKCE only. The implicit flow (access_token in
      // URL fragment) is vulnerable to custom-scheme hijack — a malicious
      // app that also registers ironspot:// could intercept the callback
      // and get a usable session immediately. PKCE callbacks carry a
      // short-lived `code` that is worthless without the `code_verifier`
      // that only this app instance has in memory.
      flowType: 'pkce',
    },
  },
);
