import { z } from 'zod';

const envSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.string().url(),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(10),
  EXPO_PUBLIC_NAVER_MAP_CLIENT_ID: z.string().min(1),
  EXPO_PUBLIC_API_URL: z.string().url(),
  // Security E6: validate DSN at module load so a malformed value
  // (typo, env var overwrite) fails fast rather than crashing
  // Sentry.init on first capture. Optional — dev / preview-simulator
  // builds run without Sentry.
  EXPO_PUBLIC_SENTRY_DSN: z.string().url().optional(),
});

const parsed = envSchema.safeParse({
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  EXPO_PUBLIC_NAVER_MAP_CLIENT_ID: process.env.EXPO_PUBLIC_NAVER_MAP_CLIENT_ID,
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  EXPO_PUBLIC_SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN,
});

if (!parsed.success) {
  throw new Error(
    `Invalid environment variables:\n${JSON.stringify(parsed.error.flatten().fieldErrors, null, 2)}`,
  );
}

export const env = parsed.data;
