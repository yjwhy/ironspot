import type { ImageSource } from 'expo-image';
import { useEffect, useState } from 'react';

import { env } from '@/shared/lib/env';
import { supabase } from '@/shared/lib/supabase';

/**
 * Security A3 Phase 2c: build an expo-image source for a photo behind the
 * authenticated proxy. expo-image fetches `API_URL + contentPath` (e.g.
 * `/api/photos/{id}/content`) with the Bearer header; the proxy 302-redirects
 * to a short-TTL Supabase signed URL, which the native image loader follows
 * (iOS strips the Authorization header on the cross-origin hop, so Supabase
 * sees only the pre-signed token). A long-lived signed URL is never persisted.
 *
 * Returns null until the session token resolves (and when contentPath is
 * absent), so callers render expo-image's placeholder meanwhile.
 */
export function useAuthedImageSource(contentPath: string | null | undefined): ImageSource | null {
  const [source, setSource] = useState<ImageSource | null>(null);

  useEffect(
    function resolveAuthedSource() {
      if (!contentPath) {
        setSource(null);
        return;
      }
      const path = contentPath;
      let active = true;
      async function resolve() {
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        const token = data.session?.access_token;
        setSource({
          uri: `${env.EXPO_PUBLIC_API_URL}${path}`,
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
      }
      void resolve();
      return function cleanup() {
        active = false;
      };
    },
    [contentPath],
  );

  return source;
}
