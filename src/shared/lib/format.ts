import dayjs from 'dayjs';

// Converts a display name to a stable testID-safe slug (e.g. "Low Row" → "low-row").
// Used as the suffix of testID props so Maestro can target elements by id: selector
// instead of text:, which breaks when a Pressable's accessibilityLabel swallows child text.
export function toTestSlug(name: string): string {
  return name.replace(/\s+/g, '-').toLowerCase();
}

export function formatDistanceKm(km: number): string {
  return `${km.toFixed(1)}km`;
}

export function formatVerifiedDate(iso: string): string {
  return dayjs(iso).format('YYYY.MM.DD');
}

const MINUTE_MS = 1000 * 60;
const HOUR_MS = MINUTE_MS * 60;
const DAY_MS = HOUR_MS * 24;

// Short Korean relative-time formatter for the admin queue. Resolution is
// minutes/hours/days — finer granularity isn't useful when the moderator just
// needs to see how stale a report is at a glance.
export function formatRelativeKo(iso: string, now: Date = new Date()): string {
  const diff = now.getTime() - new Date(iso).getTime();
  if (diff < MINUTE_MS) return '방금 전';
  if (diff < HOUR_MS) return `${String(Math.floor(diff / MINUTE_MS))}분 전`;
  if (diff < DAY_MS) return `${String(Math.floor(diff / HOUR_MS))}시간 전`;
  return `${String(Math.floor(diff / DAY_MS))}일 전`;
}
