import * as Sentry from '@sentry/react-native';
import { MMKV } from 'react-native-mmkv';
import { z } from 'zod';

import { RECENT_HISTORY_MAX } from '../constants';

const RECENT_KEY = 'nl-search-recent.v1';

const recentStorage = new MMKV({ id: 'search-recent' });

const RecentEntrySchema = z.object({
  query: z.string().min(1).max(200),
  at: z.number().int().positive(),
});

const RecentStorageSchema = z.array(RecentEntrySchema).max(RECENT_HISTORY_MAX);

export type RecentEntry = z.infer<typeof RecentEntrySchema>;

export function readRecent(): readonly RecentEntry[] {
  const raw = recentStorage.getString(RECENT_KEY);
  if (raw === undefined) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    const result = RecentStorageSchema.safeParse(parsed);
    return result.success ? result.data : [];
  } catch {
    // Corrupted JSON — treat as empty rather than crashing the search bar.
    return [];
  }
}

export function writeRecent(entries: readonly RecentEntry[]): void {
  try {
    recentStorage.set(RECENT_KEY, JSON.stringify(entries));
  } catch (err) {
    Sentry.captureException(err, { tags: { feature: 'nl-search-recent' } });
  }
}

export function clearRecent(): void {
  recentStorage.delete(RECENT_KEY);
}
