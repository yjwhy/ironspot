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
