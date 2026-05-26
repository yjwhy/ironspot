import * as Sentry from '@sentry/react-native';
import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';

const APP_NAME = 'com.ironspot.app';
const NMAP_SCHEME = 'nmap://';

export interface DirectionsGym {
  /** Server-side gym id (only used for Sentry breadcrumb correlation). */
  readonly id: string;
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
  /** Stable Naver place id, when known. When present the deeplink prefers
   * `nmap://place?id=` so the user lands on the Naver place card and can
   * pick their preferred transport mode there. Falls back to a transit
   * route deeplink when absent (registered gyms always have one, so this
   * branch is mostly dead code in practice). */
  readonly naverPlaceId?: string | null;
}

export interface DirectionsOrigin {
  /** Latitude of the route's origin. Omit / null → Naver Maps will infer
   * from the device's last-known location instead. */
  readonly latitude: number;
  readonly longitude: number;
}

export type DirectionsSource = 'card' | 'detail';

interface OpenDirectionsArgs {
  readonly gym: DirectionsGym;
  /** GPS or NL-derived reference point (e.g. 강남역). When omitted the
   * place deeplink doesn't carry an origin and Naver Maps uses its own
   * default (the device's last known location). */
  readonly origin?: DirectionsOrigin | undefined;
  /** Where in the app the directions tap originated, for the Sentry
   * breadcrumb that powers the README item 16 conversion metric. */
  readonly source: DirectionsSource;
}

/**
 * Phase 5 item 16 (ADR — README item 16): open Naver Maps directions
 * (or its in-app web fallback) for the given gym.
 *
 * Resolution order:
 *   1. `Linking.canOpenURL('nmap://')` succeeds → branch on the gym's
 *      `naverPlaceId`:
 *        • present → `nmap://place?id=...&appname=...` (Q2 — places the
 *          user on the Naver place card so they pick mode themselves)
 *        • absent → `nmap://route/public?...&dlat=...&dlng=...&dname=...&appname=...`
 *          (public transit fallback; Korean urban-gym default)
 *   2. Naver Maps not installed → in-app `expo-web-browser` opens
 *      `https://map.naver.com/v5/search/<name>` (Q3 — keeps user in
 *      IronSpot session).
 *
 * Drops a Sentry breadcrumb on each branch so the README item 16
 * "<10% conversion → reposition CTA" metric is observable without
 * dragging in a full analytics SDK (Q4).
 */
export async function openDirections({ gym, origin, source }: OpenDirectionsArgs): Promise<void> {
  const canOpenNmap = await Linking.canOpenURL(NMAP_SCHEME).catch(() => false);
  if (canOpenNmap) {
    const url = buildNmapUrl({ gym, origin });
    Sentry.addBreadcrumb({
      category: 'directions',
      message: 'open',
      level: 'info',
      data: { gymId: gym.id, source, branch: gym.naverPlaceId ? 'place' : 'route' },
    });
    await Linking.openURL(url);
    return;
  }
  Sentry.addBreadcrumb({
    category: 'directions',
    message: 'web-fallback',
    level: 'info',
    data: { gymId: gym.id, source },
  });
  await WebBrowser.openBrowserAsync(buildWebFallbackUrl(gym));
}

export function buildNmapUrl({
  gym,
  origin,
}: {
  readonly gym: DirectionsGym;
  readonly origin?: DirectionsOrigin | undefined;
}): string {
  if (gym.naverPlaceId !== null && gym.naverPlaceId !== undefined && gym.naverPlaceId !== '') {
    return `nmap://place?id=${encodeURIComponent(gym.naverPlaceId)}&appname=${APP_NAME}`;
  }
  const params = new URLSearchParams();
  if (origin !== undefined) {
    params.set('slat', String(origin.latitude));
    params.set('slng', String(origin.longitude));
  }
  params.set('dlat', String(gym.latitude));
  params.set('dlng', String(gym.longitude));
  // Security F5: cap gym name at 60 chars before it lands in the URL.
  // Naver Maps rejects URLs over ~1KB, and an attacker-influenced
  // 200-char name (e.g. via the brand-claim flow) would otherwise
  // produce an unopenable deep link.
  params.set('dname', truncateName(gym.name));
  params.set('appname', APP_NAME);
  return `nmap://route/public?${params.toString()}`;
}

export function buildWebFallbackUrl(gym: DirectionsGym): string {
  return `https://map.naver.com/v5/search/${encodeURIComponent(truncateName(gym.name))}`;
}

const MAX_GYM_NAME_LENGTH = 60;

function truncateName(name: string): string {
  return name.length > MAX_GYM_NAME_LENGTH ? name.slice(0, MAX_GYM_NAME_LENGTH) : name;
}
