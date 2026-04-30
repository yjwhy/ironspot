import dayjs from 'dayjs';

export function formatDistanceKm(km: number): string {
  return `${km.toFixed(1)}km`;
}

export function formatVerifiedDate(iso: string): string {
  return dayjs(iso).format('YYYY.MM.DD');
}
