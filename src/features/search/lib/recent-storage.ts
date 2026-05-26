import * as Sentry from '@sentry/react-native';
import { MMKV } from 'react-native-mmkv';
import { z } from 'zod';

import { RECENT_HISTORY_MAX } from '../constants';

// Security E1: bumped the storage key when the on-disk shape narrowed
// (200 → 80 char cap + control-char strip + TTL). Old `v1` entries are
// abandoned in place; the user just sees an empty history.
const RECENT_KEY = 'nl-search-recent.v2';

/**
 * Security E1: cap the per-entry payload before it lands on disk. The
 * Zod schema used to accept up to 200 chars; NL search queries are
 * typically 5-30 chars and the BE itself caps lower, so persisting
 * 200-char inputs gave an attacker (offline device extraction) a
 * larger plaintext PII surface than the BE-side log retains.
 */
const RECENT_QUERY_MAX_CHARS = 80;

/**
 * Security E1: 30-day TTL backstop. Recent searches are user-facing
 * history, not a credential, but PIPA conservatively expects raw
 * behaviour signals to expire. Match the BE-side `nl_search_log`
 * 30-day raw_query redaction (Security #31).
 */
const RECENT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const recentStorage = new MMKV({ id: 'search-recent' });

const RecentEntrySchema = z.object({
  query: z.string().min(1).max(RECENT_QUERY_MAX_CHARS),
  at: z.number().int().positive(),
});

const RecentStorageSchema = z.array(RecentEntrySchema).max(RECENT_HISTORY_MAX);

export type RecentEntry = z.infer<typeof RecentEntrySchema>;

/**
 * Security E1: NFC + strip Unicode control / format / bidi / zero-width
 * characters before persisting. Same canonical form the BE Normaliser
 * applies pre-LLM (Security #70).
 */
function sanitiseQuery(raw: string): string {
  return raw.normalize('NFC').replace(/\p{C}/gu, '').trim().slice(0, RECENT_QUERY_MAX_CHARS);
}

function dropExpired(entries: readonly RecentEntry[]): readonly RecentEntry[] {
  const cutoff = Date.now() - RECENT_TTL_MS;
  return entries.filter((entry) => entry.at >= cutoff);
}

export function readRecent(): readonly RecentEntry[] {
  const raw = recentStorage.getString(RECENT_KEY);
  if (raw === undefined) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    const result = RecentStorageSchema.safeParse(parsed);
    if (!result.success) return [];
    // Security E1: apply TTL on read so a device sitting idle for >30d
    // can't surface stale searches when the app re-opens.
    return dropExpired(result.data);
  } catch {
    // Corrupted JSON — treat as empty rather than crashing the search bar.
    return [];
  }
}

export function writeRecent(entries: readonly RecentEntry[]): void {
  try {
    // Security E1: sanitise + truncate every entry on write, even
    // entries that came from a prior read (callers append untrusted
    // user input via [...prev, { query: userInput, ... }]).
    const sanitised: RecentEntry[] = entries
      .map((entry) => ({
        query: sanitiseQuery(entry.query),
        at: entry.at,
      }))
      .filter((entry) => entry.query.length > 0);
    recentStorage.set(RECENT_KEY, JSON.stringify(sanitised));
  } catch (err) {
    Sentry.captureException(err, { tags: { feature: 'nl-search-recent' } });
  }
}

export function clearRecent(): void {
  recentStorage.delete(RECENT_KEY);
}
