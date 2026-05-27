import { z } from 'zod';

const envSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.string().url(),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(10),
  EXPO_PUBLIC_NAVER_MAP_CLIENT_ID: z.string().min(1),
  EXPO_PUBLIC_API_URL: z.string().url(),
  // Naver "네이버 아이디로 로그인" client id (separate from the maps client id
  // above). Optional: empty until the Naver app is registered, in which case
  // LoginScreen hides the Naver button. The matching client SECRET lives only
  // on the backend (NAVER_CLIENT_SECRET) — never shipped to the app.
  EXPO_PUBLIC_NAVER_CLIENT_ID: z.string().default(''),
});

const parsed = envSchema.safeParse({
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  EXPO_PUBLIC_NAVER_MAP_CLIENT_ID: process.env.EXPO_PUBLIC_NAVER_MAP_CLIENT_ID,
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  EXPO_PUBLIC_NAVER_CLIENT_ID: process.env.EXPO_PUBLIC_NAVER_CLIENT_ID,
});

if (!parsed.success) {
  throw new Error(
    `Invalid environment variables:\n${JSON.stringify(parsed.error.flatten().fieldErrors, null, 2)}`,
  );
}

export const env = parsed.data;
