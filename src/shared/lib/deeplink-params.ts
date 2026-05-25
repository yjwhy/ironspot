import { z } from 'zod';

/**
 * Security task #35 — strict Zod schemas for deep-link route params.
 *
 * Routes under `app/` receive params from three untrusted sources:
 *
 *   1. Custom-scheme deep links (`ironspot:///gym/<id>`) — controlled by
 *      anyone with the scheme on the device (other apps, push payloads,
 *      pasted URLs).
 *   2. Universal Links (when Task #16 lands) — controlled by the link
 *      origin, e.g. a Slack message body.
 *   3. Internal `router.push({pathname, params})` calls — controlled
 *      by us, but bugs can still surface invalid values.
 *
 * Without validation, a crafted deep link can drive an HTTP request like
 * `GET /api/gyms/<malicious-uuid>` whose response error message reflects
 * the bad input back into the app. Validating at the route boundary
 * collapses every category-1 + category-2 attack vector into a clean
 * "not found" UX.
 *
 * All path params in IronSpot's routes are UUIDs (gym id, machine id,
 * photo id). Search params like `gymName` are short strings with a tight
 * character set.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** UUID v1-v5 in canonical hyphenated form. */
export const uuidSchema = z.string().regex(UUID_PATTERN, 'invalid uuid');

/**
 * Short label (gym name passed as a search param so the loading state
 * can render the name before the server response). Capped at 60 chars
 * and stripped of control codepoints by the regex — the same bounds as
 * server-side {@code Location.NamedPlace.MAX_NAME_LENGTH}.
 */
export const shortLabelSchema = z
  .string()
  .max(60)
  .regex(/^[\p{L}\p{N} .,()\-]+$/u, 'unsupported character');

export const gymRouteParams = z.object({ id: uuidSchema });

export const gymMachineRouteParams = z.object({
  id: uuidSchema,
  machineId: uuidSchema,
});

export const photoRouteParams = z.object({
  id: uuidSchema,
  machineId: uuidSchema.optional(),
});

export const adminContributionRouteParams = z.object({ id: uuidSchema });

export const adminPhotoRouteParams = z.object({ id: uuidSchema });

export const adminGymMachineRouteParams = z.object({ id: uuidSchema });

export const ownerMachinesIndexParams = z.object({ gym: uuidSchema });

export const ownerMachineDetailParams = z.object({
  gym: uuidSchema,
  id: uuidSchema,
});

export const ownerMachineNewParams = z.object({ gym: uuidSchema });

export const ownerPhotosParams = z.object({ gym: uuidSchema });

export const ownerCoverParams = z.object({ gym: uuidSchema });

export const ownerClaimParams = z.object({
  gymId: uuidSchema,
  gymName: shortLabelSchema.optional(),
});

/**
 * Validate the raw expo-router params against a schema, returning either
 * the parsed values or `null` when the input was malformed. Routes should
 * render an inline "not found" view on null rather than passing undefined
 * down — that way the server never sees the bad input.
 */
export function parseRouteParams<T>(
  schema: z.ZodType<T>,
  raw: Record<string, unknown> | undefined,
): T | null {
  if (!raw) return null;
  const result = schema.safeParse(raw);
  return result.success ? result.data : null;
}
