import type { Breadcrumb, ErrorEvent } from '@sentry/react-native';

// Security task #37 — scrub PII and credentials before Sentry events / breadcrumbs leave
// the device. Three categories of leaks were possible without this scrubber:
//
//   1. Authorization headers (Bearer JWT) on automatic HTTP breadcrumbs leaked the
//      Supabase session token verbatim. Anyone with Sentry project read access could
//      impersonate the user until the JWT expired.
//   2. URL query strings (`?token=…`, `?access_token=…`) leaked OAuth callback codes,
//      Supabase signed-Storage tokens, and any future query-param credentials.
//   3. Free-text user input (NL search query, profile nickname) landed in event bodies +
//      breadcrumb messages unscrubbed.
//
// Strategy: redact at the *boundary* (beforeSend / beforeBreadcrumb) so the SDK's auto-
// instrumentation can still capture useful debug info without exfiltrating the secret.

const REDACTED = '[Filtered]';

// Header names are case-insensitive in HTTP. Sentry normalises but other layers might not,
// so we lower-case and compare.
const SENSITIVE_HEADER_NAMES = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-auth-token',
  'x-supabase-auth',
  'apikey',
]);

// URL query keys whose VALUE must be redacted. Path stays intact so the event still tells
// us which endpoint was hit.
const SENSITIVE_QUERY_KEYS = new Set([
  'token',
  'access_token',
  'refresh_token',
  'id_token',
  'code',
  'apikey',
  'api_key',
  'auth',
]);

/** Replace sensitive query-param values with `[Filtered]`. Returns the URL unchanged when parsing fails. */
export function scrubUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;
  // Sentry sometimes hands us partial URLs (path-only). Parse with a base so URL() doesn't throw.
  let parsed: URL;
  try {
    parsed = new URL(rawUrl, 'https://placeholder.invalid');
  } catch {
    return rawUrl;
  }
  let mutated = false;
  for (const key of Array.from(parsed.searchParams.keys())) {
    if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
      parsed.searchParams.set(key, REDACTED);
      mutated = true;
    }
  }
  if (!mutated) return rawUrl;
  // If original was absolute, return absolute; if relative, return relative.
  return rawUrl.startsWith('http') ? parsed.toString() : parsed.pathname + parsed.search;
}

/** Redact known sensitive header values in-place. Accepts the Sentry shape (Record<string, string>). */
export function scrubHeaders(headers: unknown): unknown {
  if (!headers || typeof headers !== 'object') return headers;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers as Record<string, string>)) {
    out[k] = SENSITIVE_HEADER_NAMES.has(k.toLowerCase()) ? REDACTED : v;
  }
  return out;
}

/** Mask an email so the local-part keeps its first 2 chars + the domain is stripped. */
export function maskEmail(value: string): string {
  if (!value || typeof value !== 'string') return value;
  const at = value.indexOf('@');
  if (at < 0) return value;
  const local = value.substring(0, at);
  const visible = local.substring(0, Math.min(2, local.length));
  return `${visible}***`;
}

/** Sentry's `beforeSend` hook. Mutates and returns the event; returning null drops it. */
export function scrubErrorEvent(event: ErrorEvent, _hint: unknown): ErrorEvent | null {
  if (event.request) {
    if (event.request.url) {
      event.request.url = scrubUrl(event.request.url);
    }
    if (event.request.headers) {
      event.request.headers = scrubHeaders(event.request.headers) as typeof event.request.headers;
    }
    // Request bodies are almost never useful in Sentry and often carry credentials. Drop entirely.
    if ('data' in event.request) {
      delete event.request.data;
    }
  }
  if (event.user?.email) {
    event.user.email = maskEmail(event.user.email);
  }
  if (event.user?.ip_address) {
    // Sentry's own setting handles this server-side, but defence-in-depth.
    event.user.ip_address = REDACTED;
  }
  return event;
}

/** Sentry's `beforeBreadcrumb` hook. Mutates and returns the breadcrumb; returning null drops it. */
export function scrubBreadcrumb(crumb: Breadcrumb): Breadcrumb | null {
  // HTTP breadcrumbs carry url + status_code + method. Strip credentials from URLs.
  if (
    (crumb.category === 'http' || crumb.category === 'fetch' || crumb.category === 'xhr') &&
    crumb.data?.url &&
    typeof crumb.data.url === 'string'
  ) {
    crumb.data.url = scrubUrl(crumb.data.url);
  }
  // Navigation breadcrumbs sometimes carry from/to URLs that include OAuth callback codes.
  if (crumb.category === 'navigation' && crumb.data) {
    if (typeof crumb.data.from === 'string') crumb.data.from = scrubUrl(crumb.data.from);
    if (typeof crumb.data.to === 'string') crumb.data.to = scrubUrl(crumb.data.to);
  }
  return crumb;
}
